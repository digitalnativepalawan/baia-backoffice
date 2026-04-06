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
    occupied: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    arriving: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    departing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
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
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2.5">
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
      // Get user + role
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await from('user_roles')
        .select('role, full_name')
        .eq('user_id', user?.id)
        .single();

      const role = (profile as any)?.role || 'reception';
      const userName = ((profile as any)?.full_name || 'there').split(' ')[0];

      // Core data
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

      // Occupancy logic — same as MorningBriefing
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

      const workflowById = new Map(
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

      // Build bookings list
      const bookings = opsUnits.flatMap((unit: any) => {
        const wf = workflowById.get(unit.id);
        if (!wf) return [];
        const active = (bookingsByUnitId.get(unit.id) || []).find(
          (b: any) => !b.checked_out_at && b.check_in <= today && b.check_out >= today
        );
        if (!active) return [];
        const status: 'occupied' | 'arriving' | 'departing' =
          wf.pendingArrival ? 'arriving'
          : wf.pendingDeparture ? 'departing'
          : 'occupied';
        return [{
          unitName: getUnitName(active),
          guestName: getGuestName(active),
          status,
          source: active.source,
          ratePerNight: active.rate_per_night,
          checkOut: active.check_out,
        }];
      });

      // Stats
      const occupiedRooms = opsUnits.filter(
        (u: any) => workflowById.get(u.id)?.displayStatus === 'occupied'
      ).length;
      const arrivalsToday = opsUnits.filter(
        (u: any) => workflowById.get(u.id)?.pendingArrival
      ).length;
      const departuresToday = opsUnits.filter(
        (u: any) => workflowById.get(u.id)?.pendingDeparture
      ).length;

      // Revenue — admin/owner/gm only
      let revenue = null;
      if (canSeeSales(role)) {
        const [todayRevRes, monthRevRes, settingsRes] = await Promise.all([
          from('resort_ops_bookings')
            .select('rate_per_night')
            .eq('check_in', today),
          from('resort_ops_bookings')
            .select('rate_per_night, check_in, check_out')
            .gte('check_in', firstOfMonth)
            .lte('check_in', today),
          from('resort_settings')
            .select('monthly_revenue_goal')
            .single(),
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
        occupiedRooms, arrivalsToday, departuresToday,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-6 pb-6 overflow-y-auto">
      <div className="w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-start px-4 py-4 border-b border-border">
          <div className="flex items-start gap-2.5">
            <Sun className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold text-foreground">
                {isLoading ? 'Loading…' : `Good morning, ${d?.userName} 👋`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {getManilaDateLabel()} · {roleLabel}
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 ml-2"
          >
            <X size={12} />
          </button>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Preparing your briefing…
          </div>
        ) : d ? (
          <>
            {/* Room stats */}
            <div className="px-4 py-4 border-b border-border">
              <SectionLabel>Room status today</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BedDouble, num: d.occupiedRooms, lbl: 'Occupied', cls: 'text-red-500 dark:text-red-400' },
                  { icon: LogIn, num: d.arrivalsToday, lbl: 'Arriving', cls: 'text-green-600 dark:text-green-400' },
                  { icon: LogOut, num: d.departuresToday, lbl: 'Departing', cls: 'text-amber-500 dark:text-amber-400' },
                ].map((s) => (
                  <div key={s.lbl} className="bg-muted rounded-lg py-3 px-2 text-center">
                    <p className={`text-2xl font-semibold ${s.cls}`}>{s.num}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bookings */}
            <div className="px-4 py-4 border-b border-border">
              <SectionLabel>Today's bookings</SectionLabel>
              {d.bookings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No active bookings today</p>
              ) : (
                <div className="space-y-2.5">
                  {d.bookings.map((b, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          b.unitName.toLowerCase().includes('sui') ? 'bg-purple-400' : 'bg-blue-400'
                        }`} />
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{b.unitName}</p>
                          <p className="text-[11px] text-muted-foreground">
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

            {/* Sales — GM / Admin / Owner only */}
            {d.revenue && (
              <div className="px-4 py-4 border-b border-border">
                <SectionLabel>Sales snapshot · today</SectionLabel>

                {/* Confirmed revenue */}
                <div className="bg-muted rounded-lg p-3.5 mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Confirmed booking revenue</p>
                      <p className="text-[30px] font-semibold text-foreground leading-none">
                        ₱{d.revenue.confirmedToday.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-green-500 mt-1" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Monthly: ₱{d.revenue.monthlyActual.toLocaleString()} of ₱{d.revenue.monthlyGoal.toLocaleString()} ({progressPct}%)
                  </p>
                  <div className="mt-1.5 h-1.5 bg-border rounded-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* Upsells */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { icon: '🍽', label: 'F&B potential', amt: d.revenue.upsellFnb },
                    { icon: '🏝', label: 'Island hopping', amt: d.revenue.upsellIsland },
                    { icon: '🚤', label: 'Tours', amt: d.revenue.upsellTours },
                    { icon: '🏍', label: 'Motorbike rental', amt: d.revenue.upsellMoto },
                  ].map((u) => (
                    <div key={u.label} className="bg-muted rounded-lg px-3 py-2.5">
                      <p className="text-sm mb-1">{u.icon}</p>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{u.label}</p>
                      <p className="text-[14px] font-semibold text-foreground">
                        ₱{u.amt.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total potential */}
                <div className="flex justify-between items-center bg-muted rounded-lg px-3 py-2.5">
                  <p className="text-[12px] text-muted-foreground">Total potential today</p>
                  <p className="text-[18px] font-semibold text-green-600 dark:text-green-400">
                    ₱{totalPotential.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 flex justify-between items-center">
              <p className="text-[11px] text-muted-foreground">Logged in as: {roleLabel}</p>
              <button
                onClick={dismiss}
                className="text-[12px] font-medium px-4 py-2 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Got it, let's go →
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
