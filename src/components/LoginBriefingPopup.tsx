import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveOperationalUnitWorkflow } from '@/lib/receptionOccupancy';
import { X, Sun, TrendingUp, BedDouble, LogIn, LogOut } from 'lucide-react';

const from = (table: string) => supabase.from(table as any);

const getManilaDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const getManilaDateLabel = () =>
  new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

const normalizeRoomName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const canSeeSales = (role: string) =>
  ['admin', 'owner', 'gm', 'manager'].includes(role);

function StatusPill({ status }: { status: 'occupied' | 'arriving' | 'departing' }) {
  const styles = {
    occupied: 'bg-red-500/20 text-red-400',
    arriving: 'bg-green-500/20 text-green-400',
    departing: 'bg-amber-500/20 text-amber-400',
  };
  const labels = { occupied: 'Occupied', arriving: 'Arriving', departing: 'Departing' };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium mb-2.5">
      {children}
    </p>
  );
}

function useBriefingData(enabled: boolean) {
  const today = getManilaDate();
  const firstOfMonth = today.slice(0, 7) + '-01';

  return useQuery({
    queryKey: ['login-briefing', today],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await from('user_roles')
        .select('role, full_name')
        .eq('user_id', user?.id)
        .single();

      const role = (profile as any)?.role || 'reception';
      const userName = ((profile as any)?.full_name || 'there').split(' ')[0];

      // exact same queries as MorningBriefing
      const [unitsRes, bookingsRes, opsUnitsRes] = await Promise.all([
        from('units').select('id, status, unit_name'),
        from('resort_ops_bookings').select(
          'id, check_in, check_out, checked_in_at, checked_out_at, unit_id, rate_per_night, source, resort_ops_guests(full_name), resort_ops_units:unit_id(name)'
        ),
        from('resort_ops_units').select('id, name'),
      ]);

      const units = (unitsRes.data as any[]) || [];
      const allBookings = (bookingsRes.data as any[]) || [];
      const opsUnits = (opsUnitsRes.data as any[]) || [];

      // exact same logic as MorningBriefing
      const opsUnitNameById = new Map(opsUnits.map((u: any) => [u.id, u.name]));
      const opsUnitIdByName = new Map(
        opsUnits.map((u: any) => [normalizeRoomName(u.name), u.id])
      );
      const unitStatusMap = new Map<string, string>();
      units.forEach((u: any) => {
        const id = opsUnitIdByName.get(normalizeRoomName(u.unit_name || ''));
        if (id) unitStatusMap.set(id, u.status);
      });

      const bookingsByUnitId = new Map<string, any[]>();
      allBookings.forEach((b: any) => {
        if (!b.unit_id) return;
        const curr = bookingsByUnitId.get(b.unit_id) || [];
        curr.push(b);
        bookingsByUnitId.set(b.unit_id, curr);
      });

      const unitWorkflowById = new Map(
        opsUnits.map((unit: any) => [
          unit.id,
          resolveOperationalUnitWorkflow({
            bookings: bookingsByUnitId.get(unit.id) || [],
            rawStatus: unitStatusMap.get(unit.id),
            today,
          }),
        ])
      );

      const getUnitName = (b: any) =>
        b.resort_ops_units?.name || opsUnitNameById.get(b.unit_id) || 'Room';
      const getGuestName = (b: any) =>
        b.resort_ops_guests?.full_name || 'Guest';

      // stats — exact same as MorningBriefing
      const occupiedRooms = opsUnits.filter(
        (u: any) => unitWorkflowById.get(u.id)?.displayStatus === 'occupied'
      ).length;

      const pendingArrivals = opsUnits
        .map((u: any) => unitWorkflowById.get(u.id)?.pendingArrival)
        .filter(Boolean);

      const pendingDepartures = opsUnits
        .map((u: any) => unitWorkflowById.get(u.id)?.pendingDeparture)
        .filter(Boolean);

      // build booking cards from arrivals + occupied + departures
      const seen = new Set<string>();
      const bookings: any[] = [];

      pendingArrivals.forEach((b: any) => {
        if (seen.has(b.id)) return;
        seen.add(b.id);
        bookings.push({
          unitName: getUnitName(b),
          guestName: getGuestName(b),
          status: 'arriving',
          source: b.source,
          ratePerNight: b.rate_per_night,
        });
      });

      opsUnits.forEach((unit: any) => {
        const wf = unitWorkflowById.get(unit.id);
        if (wf?.displayStatus !== 'occupied') return;
        const unitBookings = bookingsByUnitId.get(unit.id) || [];
        const active = unitBookings.find(
          (b: any) => b.checked_in_at && !b.checked_out_at
        );
        if (!active || seen.has(active.id)) return;
        seen.add(active.id);
        bookings.push({
          unitName: getUnitName(active),
          guestName: getGuestName(active),
          status: 'occupied',
          source: active.source,
          ratePerNight: active.rate_per_night,
        });
      });

      pendingDepartures.forEach((b: any) => {
        if (seen.has(b.id)) return;
        seen.add(b.id);
        bookings.push({
          unitName: getUnitName(b),
          guestName: getGuestName(b),
          status: 'departing',
          source: b.source,
          ratePerNight: b.rate_per_night,
        });
      });

      // revenue for admin/gm/owner
      let revenue = null;
      if (canSeeSales(role)) {
        const [todayRevRes, monthRevRes, settingsRes] = await Promise.all([
          from('resort_ops_bookings').select('rate_per_night').eq('check_in', today),
          from('resort_ops_bookings')
            .select('rate_per_night, check_in, check_out')
            .gte('check_in', firstOfMonth)
            .lte('check_in', today),
          from('resort_settings').select('monthly_revenue_goal').single(),
        ]);

        const confirmedToday = ((todayRevRes.data as any[]) || []).reduce(
          (s: number, r: any) => s + (Number(r.rate_per_night) || 0), 0
        );
        const monthlyActual = ((monthRevRes.data as any[]) || []).reduce(
          (s: number, r: any) => {
            const nights = Math.max(1, Math.round(
              (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000
            ));
            return s + (Number(r.rate_per_night) || 0) * nights;
          }, 0
        );

        revenue = {
          confirmedToday,
          monthlyActual,
          monthlyGoal: (settingsRes.data as any)?.monthly_revenue_goal || 300000,
          upsellFnb: 3500,
          upsellIsland: 6000,
          upsellTours: 4000,
          upsellMoto: 2400,
        };
      }

      return {
        userName, role,
        occupiedRooms,
        arrivalsToday: pendingArrivals.length,
        departuresToday: pendingDepartures.length,
        totalRooms: opsUnits.length,
        bookings, revenue,
      };
    },
  });
}

export default function LoginBriefingPopup() {
  const today = getManilaDate();
  const storageKey = `baia_briefing_dismissed_${today}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  const { data: d, isLoading } = useBriefingData(visible);

  function dismiss() {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const roleLabel =
    d?.role === 'admin' || d?.role === 'owner' ? 'Admin / Owner'
    : d?.role === 'gm' || d?.role === 'manager' ? 'General Manager'
    : 'Reception';

  const progressPct = d?.revenue
    ? Math.min(100, Math.round((d.revenue.monthlyActual / d.revenue.monthlyGoal) * 100))
    : 0;

  const totalPotential = d?.revenue
    ? d.revenue.confirmedToday + d.revenue.upsellFnb + d.revenue.upsellIsland +
      d.revenue.upsellTours + d.revenue.upsellMoto
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-6 pb-6 overflow-y-auto">
      <div className="w-full max-w-sm bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

        <div className="flex justify-between items-start px-4 py-4 border-b border-white/10">
          <div className="flex items-start gap-2.5">
            <Sun className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold text-white">
                {isLoading ? 'Loading…' : `Good morning, ${d?.userName} 👋`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {getManilaDateLabel()} · {roleLabel}
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors shrink-0 ml-2">
            <X size={12} />
          </button>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            Preparing your briefing…
          </div>
        ) : d ? (
          <>
            <div className="px-4 py-4 border-b border-white/10">
              <SectionLabel>Room status today</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BedDouble, num: d.occupiedRooms, lbl: 'Occupied', cls: 'text-red-400' },
                  { icon: LogIn, num: d.arrivalsToday, lbl: 'Arriving', cls: 'text-green-400' },
                  { icon: LogOut, num: d.departuresToday, lbl: 'Departing', cls: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.lbl} className="bg-white/5 rounded-lg py-3 px-2 text-center">
                    <p className={`text-2xl font-semibold ${s.cls}`}>{s.num}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{s.lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-4 border-b border-white/10">
              <SectionLabel>Today's bookings</SectionLabel>
              {d.bookings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No active bookings today</p>
              ) : (
                <div className="space-y-2.5">
                  {d.bookings.map((b, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.unitName.toLowerCase().includes('sui') ? 'bg-purple-400' : 'bg-blue-400'}`} />
                        <div>
                          <p className="text-[13px] font-medium text-white">{b.unitName}</p>
                          <p className="text-[11px] text-slate-400">
                            {b.guestName}{b.source ? ` · ${b.source}` : ''}
                            {b.ratePerNight ? ` · ₱${Number(b.ratePerNight).toLocaleString()}/night` : ''}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {d.revenue && (
              <div className="px-4 py-4 border-b border-white/10">
                <SectionLabel>Sales snapshot · today</SectionLabel>
                <div className="bg-white/5 rounded-lg p-3.5 mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Confirmed booking revenue</p>
                      <p className="text-[30px] font-semibold text-white leading-none">
                        ₱{d.revenue.confirmedToday.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-green-400 mt-1" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Monthly: ₱{d.revenue.monthlyActual.toLocaleString()} of ₱{d.revenue.monthlyGoal.toLocaleString()} ({progressPct}%)
                  </p>
                  <div className="mt-1.5 h-1.5 bg-white/10 rounded-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { icon: '🍽', label: 'F&B potential', amt: d.revenue.upsellFnb },
                    { icon: '🏝', label: 'Island hopping', amt: d.revenue.upsellIsland },
                    { icon: '🚤', label: 'Tours', amt: d.revenue.upsellTours },
                    { icon: '🏍', label: 'Motorbike rental', amt: d.revenue.upsellMoto },
                  ].map((u) => (
                    <div key={u.label} className="bg-white/5 rounded-lg px-3 py-2.5">
                      <p className="text-sm mb-1">{u.icon}</p>
                      <p className="text-[10px] text-slate-400 mb-0.5">{u.label}</p>
                      <p className="text-[14px] font-semibold text-white">₱{u.amt.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-2.5">
                  <p className="text-[12px] text-slate-400">Total potential today</p>
                  <p className="text-[18px] font-semibold text-green-400">₱{totalPotential.toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="px-4 py-3 flex justify-between items-center">
              <p className="text-[11px] text-slate-500">Logged in as: {roleLabel}</p>
              <button onClick={dismiss} className="text-[12px] font-medium px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors">
                Got it, let's go →
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
