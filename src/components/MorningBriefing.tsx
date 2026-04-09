import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { resolveOperationalUnitWorkflow } from '@/lib/receptionOccupancy';
import {
  Sun, BedDouble, LogIn, LogOut, Sparkles, UtensilsCrossed,
  ClipboardList, Zap, MapPin, Bell, Car,
} from 'lucide-react';

const from = (table: string) => supabase.from(table as any);

const getManilaDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const normalizeRoomName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const getManilaTimeStr = () =>
  new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

interface OpsTask {
  label: string;
  icon: 'arrival' | 'departure' | 'kitchen' | 'tour' | 'request' | 'clean';
  urgent?: boolean;
}

interface BriefingData {
  occupiedRooms: number;
  totalRooms: number;
  arrivalsToday: number;
  departuresToday: number;
  roomsToClean: number;
  pendingKitchenOrders: number;
  adminTasks: { title: string; assignee: string }[];
  opsTasks: OpsTask[];
}

function useMorningBriefing() {
  const today = getManilaDate();

  return useQuery<BriefingData>({
    queryKey: ['morning-briefing', today],
    queryFn: async () => {
        const [
          unitsRes, bookingsRes, ordersRes, tasksRes, employeesRes, opsUnitsRes,
          toursRes, requestsRes,
        ] = await Promise.all([
          from('units').select('id, status, unit_name'),
          from('resort_ops_bookings').select('id, check_in, check_out, checked_in_at, checked_out_at, unit_id, resort_ops_guests(full_name), resort_ops_units:unit_id(name)'),
        from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['New', 'Preparing']),
        from('employee_tasks')
          .select('title, employee_id, status, due_date')
          .eq('status', 'pending')
          .lte('due_date', today + 'T23:59:59')
          .is('archived_at', null),
        from('employees').select('id, display_name, name'),
        from('resort_ops_units').select('id, name'),
        // Today's tours
        from('guest_tours')
          .select('tour_name, unit_name, pax, status, tour_date, pickup_time')
          .eq('tour_date', today)
          .in('status', ['booked', 'confirmed']),
        // Pending guest requests
        from('guest_requests')
          .select('request_type, details, guest_name, status')
          .eq('status', 'pending'),
      ]);

      const units = (unitsRes.data as any[]) || [];
      const bookings = (bookingsRes.data as any[]) || [];
      const totalRooms = units.length;
      const employees = (employeesRes.data as any[]) || [];
      const opsUnits = (opsUnitsRes.data as any[]) || [];
      const pendingKitchenCount = ordersRes.count || 0;
      const tours = (toursRes.data as any[]) || [];
      const requests = (requestsRes.data as any[]) || [];

      // --- Stats ---
      const opsUnitNameById = new Map(opsUnits.map((u: any) => [u.id, u.name]));
      const opsUnitIdByName = new Map(opsUnits.map((u: any) => [normalizeRoomName(u.name), u.id]));
      const unitStatusMap = new Map<string, string>();

      units.forEach((u: any) => {
        const opsUnitId = opsUnitIdByName.get(normalizeRoomName(u.unit_name || ''));
        if (opsUnitId) unitStatusMap.set(opsUnitId, u.status);
      });

      const bookingsByUnitId = new Map<string, any[]>();
      bookings.forEach((booking: any) => {
        if (!booking.unit_id) return;
        const current = bookingsByUnitId.get(booking.unit_id) || [];
        current.push(booking);
        bookingsByUnitId.set(booking.unit_id, current);
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

      const occupiedRooms = opsUnits.filter((unit: any) => unitWorkflowById.get(unit.id)?.displayStatus === 'occupied').length;

      const roomsToClean = units.filter(
        (u) => u.status === 'dirty' || u.status === 'cleaning' || u.status === 'to_clean'
      ).length;

      const pendingArrivals = opsUnits
        .map((unit: any) => unitWorkflowById.get(unit.id)?.pendingArrival)
        .filter(Boolean);

      const pendingDepartures = opsUnits
        .map((unit: any) => unitWorkflowById.get(unit.id)?.pendingDeparture)
        .filter(Boolean);

      // --- Admin tasks ---
      const empMap = new Map(employees.map((e: any) => [e.id, e.display_name || e.name || 'Staff']));
      const adminTasks = ((tasksRes.data as any[]) || []).map((t: any) => ({
        title: t.title,
        assignee: empMap.get(t.employee_id) || 'Unassigned',
      }));

      // --- Real-time Ops Tasks ---
      const opsTasks: OpsTask[] = [];

      const getUnitName = (b: any) => {
        if (b.resort_ops_units?.name) return b.resort_ops_units.name;
        return opsUnitNameById.get(b.unit_id) || 'Room';
      };
      const getGuestName = (b: any) => b.resort_ops_guests?.full_name || 'Guest';

      // Arrivals — only show guests not yet checked in
      pendingArrivals.forEach((b: any) => {
        opsTasks.push({
          label: `Prepare ${getUnitName(b)} for arrival — ${getGuestName(b)}`,
          icon: 'arrival',
          urgent: true,
        });
      });

      // Departures — only show guests still in-house and pending checkout
      pendingDepartures.forEach((b: any) => {
        opsTasks.push({
          label: `Checkout pending: ${getUnitName(b)} — ${getGuestName(b)}`,
          icon: 'departure',
        });
      });

      // Rooms to clean
      if (roomsToClean > 0) {
          const dirtyNames = units
            .filter((u) => u.status === 'dirty' || u.status === 'cleaning' || u.status === 'to_clean')
            .map((u) => u.unit_name || 'Room');
        opsTasks.push({
          label: `Clean ${dirtyNames.length} room${dirtyNames.length > 1 ? 's' : ''}: ${dirtyNames.join(', ')}`,
          icon: 'clean',
          urgent: true,
        });
      }

      // Tours today
      tours.forEach((t: any) => {
        opsTasks.push({
          label: `Tour: ${t.tour_name} — ${t.unit_name}, ${t.pax} pax${t.pickup_time ? ` @ ${t.pickup_time}` : ''}`,
          icon: 'tour',
        });
      });

      // Pending guest requests
      requests.forEach((r: any) => {
        const type = (r.request_type || 'request').replace(/_/g, ' ');
        opsTasks.push({
          label: `${type}: ${r.details || 'No details'} — ${r.guest_name || 'Guest'}`,
          icon: 'request',
          urgent: true,
        });
      });

      // Pending kitchen orders
      if (pendingKitchenCount > 0) {
        opsTasks.push({
          label: `${pendingKitchenCount} pending kitchen order${pendingKitchenCount > 1 ? 's' : ''}`,
          icon: 'kitchen',
        });
      }

      opsUnits.forEach((unit: any) => {
        const workflow = unitWorkflowById.get(unit.id);
        if (!workflow?.isExtensionReview || !workflow.pendingArrival) return;
        opsTasks.push({
          label: `Review possible stay extension in ${unit.name} — ${getGuestName(workflow.pendingArrival)}`,
          icon: 'request',
          urgent: true,
        });
      });

      // If nothing, show all-clear
      if (opsTasks.length === 0) {
        opsTasks.push({ label: 'All clear — no pending operations', icon: 'kitchen' });
      }

        return {
          occupiedRooms,
          totalRooms,
          arrivalsToday: pendingArrivals.length,
          departuresToday: pendingDepartures.length,
          roomsToClean,
          pendingKitchenOrders: pendingKitchenCount,
        adminTasks,
        opsTasks,
      };
    },
    refetchInterval: 15_000, // More frequent for real-time ops
    staleTime: 5_000,
  });
}

const statsDef = [
  { key: 'occupancy', icon: BedDouble, label: 'Occupancy' },
  { key: 'arrivals', icon: LogIn, label: 'Arrivals today' },
  { key: 'departures', icon: LogOut, label: 'Departures today' },
  { key: 'cleaning', icon: Sparkles, label: 'Rooms to clean' },
  { key: 'kitchen', icon: UtensilsCrossed, label: 'Pending kitchen' },
] as const;

const opsIconMap: Record<string, typeof LogIn> = {
  arrival: LogIn,
  departure: LogOut,
  kitchen: UtensilsCrossed,
  tour: MapPin,
  request: Bell,
  clean: Sparkles,
};

const MorningBriefing = ({ role = "reception" }: { role?: string }) => {
  const { data: rawData, isLoading } = useMorningBriefing();
  const data = rawData ? { ...rawData, adminTasks: rawData.adminTasks || [], opsTasks: rawData.opsTasks || [] } : undefined;
  const [expanded, setExpanded] = useState(false);

  // Filter ops tasks by role relevance
  const filterTasksForRole = (tasks: OpsTask[]) => {
    if (role === 'reception') return tasks; // reception sees everything
    if (role === 'housekeeping') return tasks.filter(t => t.icon === 'clean' || t.icon === 'arrival' || t.icon === 'departure');
    if (role === 'experiences') return tasks.filter(t => t.icon === 'tour' || t.icon === 'request');
    return tasks;
  };

  const occupancy = data ? `${data.occupiedRooms} / ${data.totalRooms}` : '…';
  const arrivals = data ? data.arrivalsToday : null;
  const departures = data ? data.departuresToday : null;
  const hasUrgent = data ? (data.opsTasks.some(t => t.urgent) || arrivals! > 0) : false;

  return (
    <Card className="border-primary/20 bg-primary/5 mb-4">
      <CardContent className="p-0">
        {/* Always-visible summary row — tap to expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Sun className="h-4 w-4 text-primary shrink-0" />
            <div className="flex items-center gap-4 min-w-0">
              {/* Occupancy — always shown */}
              <div className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm text-foreground">{isLoading ? '…' : occupancy}</span>
              </div>
              {/* Arrivals — shown if > 0 */}
              {!isLoading && arrivals !== null && arrivals > 0 && (
                <div className="flex items-center gap-1.5">
                  <LogIn className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="text-sm font-semibold text-success">{arrivals} in</span>
                </div>
              )}
              {/* Departures — shown if > 0 */}
              {!isLoading && departures !== null && departures > 0 && (
                <div className="flex items-center gap-1.5">
                  <LogOut className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{departures} out</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasUrgent && !expanded && (
              <span className="h-2 w-2 rounded-full bg-amber-400" />
            )}
            {expanded
              ? <Car className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
              : <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            }
            <span className="text-[11px] text-muted-foreground">{expanded ? 'less' : 'more'}</span>
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && !isLoading && data && (
          <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
            {/* All stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Sparkles, label: 'To clean', value: data.roomsToClean },
                ...(role === 'reception' ? [{ icon: UtensilsCrossed, label: 'Kitchen orders', value: data.pendingKitchenOrders }] : []),
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md bg-background/60 border border-border/50 px-3 py-2">
                  <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    <p className="text-sm font-semibold text-foreground">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live operations */}
            {data.opsTasks.length > 0 && (
              <div className="rounded-md bg-background/60 border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground tracking-wide">Live Operations</h3>
                </div>
                <ul className="space-y-1.5">
                  {filterTasksForRole(data.opsTasks).map((t, i) => {
                    const Icon = opsIconMap[t.icon] || Zap;
                    return (
                      <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${t.urgent ? 'text-amber-400' : 'text-muted-foreground'}`} />
                        <span className={t.urgent ? 'text-foreground font-medium' : 'text-foreground'}>{t.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Admin tasks */}
            {data.adminTasks.length > 0 && (
              <div className="rounded-md bg-background/60 border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground tracking-wide">Admin Tasks</h3>
                </div>
                <ul className="space-y-1">
                  {data.adminTasks.map((t, i) => (
                    <li key={i} className="text-xs text-foreground leading-relaxed">
                      <span className="text-muted-foreground mr-1">•</span>
                      {t.title} <span className="text-muted-foreground">— {t.assignee}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MorningBriefing;
