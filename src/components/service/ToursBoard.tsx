import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, Clock, Users, Car, Palmtree, Bike,
  StickyNote, CheckCircle2, XCircle, Flag,
} from 'lucide-react';
import { getStaffSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';

// ── Types ──────────────────────────────────────────────────────────────────

interface TourItem {
  id: string;
  source: 'tour_bookings' | 'guest_requests';
  type: 'Tours' | 'Transport' | 'Rentals';
  guestName: string;
  name: string;
  date: string | null;
  pax: number | null;
  pickupTime: string | null;
  price: number;
  notes: string;
  status: string;
  createdAt: string;
  roomId: string | null;
  bookingId: string | null;
  raw: any;
}

type TimeFilter = 'all' | 'today' | 'upcoming';
type TypeFilter = 'all' | 'tours' | 'transport' | 'rentals';
type ColKey = 'pending' | 'confirmed' | 'today';

// ── Helpers ────────────────────────────────────────────────────────────────

const parsePriceFromDetails = (details: string): number => {
  if (!details) return 0;
  const match = details.match(/₱([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
};

const mapBookingToItem = (b: any): TourItem => ({
  id: b.id,
  source: 'tour_bookings',
  type: 'Tours',
  guestName: b.guest_name || '',
  name: b.tour_name || '(Unnamed Tour)',
  date: b.tour_date || null,
  pax: b.pax != null ? Number(b.pax) : null,
  pickupTime: b.pickup_time || null,
  price: Number(b.price) || 0,
  notes: b.notes || '',
  status: b.status || 'pending',
  createdAt: b.created_at,
  roomId: b.room_id || null,
  bookingId: b.booking_id || null,
  raw: b,
});

const mapRequestToItem = (r: any): TourItem => {
  const t = (r.request_type || '').toLowerCase();
  const isRental = t.includes('rental') || t.includes('scooter') || t.includes('bike');
  return {
    id: r.id,
    source: 'guest_requests',
    type: isRental ? 'Rentals' : 'Transport',
    guestName: r.guest_name || '',
    name: r.request_type || 'Request',
    date: null,
    pax: null,
    pickupTime: null,
    price: parsePriceFromDetails(r.details || ''),
    notes: r.details || '',
    status: r.status || 'pending',
    createdAt: r.created_at,
    roomId: r.room_id || null,
    bookingId: r.booking_id || null,
    raw: r,
  };
};

const getColumn = (item: TourItem, todayStr: string): ColKey => {
  if (item.status === 'pending') return 'pending';
  if (item.date === todayStr) return 'today';
  return 'confirmed';
};

const COL_COLORS: Record<ColKey, string> = {
  pending: 'border-t-amber-400',
  confirmed: 'border-t-emerald-400',
  today: 'border-t-blue-400',
};

const COL_LABELS: Record<ColKey, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  today: 'Today',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const TYPE_ICON: Record<TourItem['type'], React.ReactNode> = {
  Tours: <Palmtree className="w-3 h-3" />,
  Transport: <Car className="w-3 h-3" />,
  Rentals: <Bike className="w-3 h-3" />,
};

// ── Main Component ─────────────────────────────────────────────────────────

const ToursBoard = () => {
  const qc = useQueryClient();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevPendingCountRef = useRef(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const session = useMemo(() => getStaffSession(), []);
  const staffName = session?.name || 'Staff';
  const perms: string[] = session?.permissions || [];
  const isAdmin = perms.includes('admin');
  const canAct = isAdmin || canEdit(perms, 'experiences') || canEdit(perms, 'reception');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const sevenDaysAgo = useMemo(() => subDays(new Date(), 7).toISOString(), []);
  const yesterdayStr = useMemo(() => subDays(new Date(), 1).toISOString().split('T')[0], []);

  // Unlock AudioContext on first interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    // Two-tone ding-dong (E5 → B5)
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.22);
      osc.connect(gain);
      osc.start(t + i * 0.22);
      osc.stop(t + i * 0.22 + 0.3);
    });
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const ch1 = supabase
      .channel('tours-board-bookings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tour_bookings' }, () => {
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      })
      .subscribe();
    const ch2 = supabase
      .channel('tours-board-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_requests' }, () => {
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [qc]);

  // Fetch tour_bookings (active + today)
  const { data: rawBookings = [] } = useQuery({
    queryKey: ['tours-board-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('tour_bookings') as any)
        .select('*')
        .not('status', 'eq', 'cancelled')
        .gte('tour_date', yesterdayStr)
        .order('tour_date', { ascending: true })
        .order('pickup_time', { ascending: true })
        .limit(150);
      return (data || []) as any[];
    },
    refetchInterval: 10000,
  });

  // Fetch guest_requests (Transport + Rental)
  const { data: rawRequests = [] } = useQuery({
    queryKey: ['tours-board-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('guest_requests')
        .select('*')
        .in('request_type', ['Transport', 'Rental'])
        .in('status', ['pending', 'confirmed'])
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    refetchInterval: 10000,
  });

  // Map to unified items
  const allItems = useMemo(
    () => [...rawBookings.map(mapBookingToItem), ...rawRequests.map(mapRequestToItem)],
    [rawBookings, rawRequests],
  );

  // Apply time + type filters
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (typeFilter === 'tours' && item.type !== 'Tours') return false;
      if (typeFilter === 'transport' && item.type !== 'Transport') return false;
      if (typeFilter === 'rentals' && item.type !== 'Rentals') return false;
      if (timeFilter === 'today') {
        // For bookings with a date, only show today's; requests (no date) always shown
        if (item.date && item.date !== todayStr) return false;
      } else if (timeFilter === 'upcoming') {
        if (item.date && item.date <= todayStr) return false;
      }
      return true;
    });
  }, [allItems, timeFilter, typeFilter, todayStr]);

  // Split into 3 kanban columns
  const columns = useMemo(() => {
    const cols: Record<ColKey, TourItem[]> = { pending: [], confirmed: [], today: [] };
    filteredItems.forEach(item => {
      cols[getColumn(item, todayStr)].push(item);
    });
    // Sort each column
    const byCreated = (a: TourItem, b: TourItem) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    cols.pending.sort(byCreated);
    cols.today.sort((a, b) => {
      if (a.pickupTime && b.pickupTime) return a.pickupTime.localeCompare(b.pickupTime);
      return byCreated(a, b);
    });
    cols.confirmed.sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      return byCreated(a, b);
    });
    return cols;
  }, [filteredItems, todayStr]);

  // Chime on new pending items
  useEffect(() => {
    const count = columns.pending.length;
    if (count > prevPendingCountRef.current) playChime();
    prevPendingCountRef.current = count;
  }, [columns.pending.length, playChime]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (item: TourItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    try {
      if (item.source === 'tour_bookings') {
        await (supabase.from('tour_bookings') as any)
          .update({ status: 'confirmed', confirmed_by: staffName })
          .eq('id', item.id);
        if (item.price > 0 && item.roomId) {
          const { data: room } = await supabase.from('units').select('id, unit_name').eq('id', item.roomId).maybeSingle();
          await (supabase.from('room_transactions') as any).insert({
            unit_id: item.roomId,
            unit_name: room?.unit_name || '',
            booking_id: item.bookingId,
            guest_name: item.guestName,
            transaction_type: 'charge',
            amount: item.price,
            tax_amount: 0,
            service_charge_amount: 0,
            total_amount: item.price,
            payment_method: 'Charge to Room',
            staff_name: staffName,
            notes: `Tour: ${item.name} (${item.pax ?? 1} pax)${item.date ? ` on ${item.date}` : ''}`,
          });
        }
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        await supabase
          .from('guest_requests')
          .update({ status: 'confirmed', confirmed_by: staffName } as any)
          .eq('id', item.id);
        if (item.price > 0 && item.roomId) {
          const { data: room } = await supabase.from('units').select('id, unit_name').eq('id', item.roomId).maybeSingle();
          await (supabase.from('room_transactions') as any).insert({
            unit_id: item.roomId,
            unit_name: room?.unit_name || '',
            booking_id: item.bookingId,
            guest_name: item.guestName,
            transaction_type: 'charge',
            amount: item.price,
            tax_amount: 0,
            service_charge_amount: 0,
            total_amount: item.price,
            payment_method: 'Charge to Room',
            staff_name: staffName,
            notes: `${item.name}: ${item.notes}`,
          });
        }
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Confirmed ✓');
    } catch {
      toast.error('Failed to confirm');
    }
  }, [canAct, staffName, qc]);

  const handleComplete = useCallback(async (item: TourItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    try {
      if (item.source === 'tour_bookings') {
        await (supabase.from('tour_bookings') as any).update({ status: 'completed' }).eq('id', item.id);
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        await supabase.from('guest_requests').update({ status: 'completed' } as any).eq('id', item.id);
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Marked complete ✓');
    } catch {
      toast.error('Failed to update');
    }
  }, [canAct, qc]);

  const handleCancel = useCallback(async (item: TourItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    try {
      if (item.source === 'tour_bookings') {
        await (supabase.from('tour_bookings') as any)
          .update({ status: 'cancelled', confirmed_by: staffName })
          .eq('id', item.id);
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        await supabase.from('guest_requests').update({ status: 'cancelled' } as any).eq('id', item.id);
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  }, [canAct, staffName, qc]);

  const totalPending = columns.pending.length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Filter pills */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 flex-shrink-0 overflow-x-auto scrollbar-hide">
        {/* Time filters */}
        {(['all', 'today', 'upcoming'] as TimeFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={`font-display text-xs tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              timeFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'Upcoming'}
          </button>
        ))}

        <div className="w-px h-4 bg-border flex-shrink-0" />

        {/* Type filters */}
        {(['all', 'tours', 'transport', 'rentals'] as TypeFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`font-display text-xs tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              typeFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {totalPending > 0 && (
          <span className="ml-auto font-body text-xs text-amber-400 font-bold whitespace-nowrap flex-shrink-0 tab-pulse px-2">
            {totalPending} pending
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* Desktop: 3-column kanban */}
        <div className="hidden md:grid gap-3 p-4 md:grid-cols-3">
          {(['pending', 'confirmed', 'today'] as ColKey[]).map(col => (
            <div
              key={col}
              className={`flex flex-col border-t-4 ${COL_COLORS[col]} rounded-t-lg bg-secondary/30`}
            >
              <div className="px-3 py-2 flex items-center justify-between">
                <h3 className="font-display text-sm tracking-wider text-foreground">
                  {COL_LABELS[col]}
                </h3>
                <span className="font-body text-xs text-muted-foreground font-bold bg-muted rounded-full w-6 h-6 flex items-center justify-center">
                  {columns[col].length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 max-h-[60vh]">
                {columns[col].map(item => (
                  <TourCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    canAct={canAct}
                    onConfirm={handleConfirm}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    compact
                  />
                ))}
                {columns[col].length === 0 && (
                  <p className="font-body text-xs text-muted-foreground text-center py-8">
                    Nothing here
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: tabs */}
        <MobileTourTabView
          columns={columns}
          canAct={canAct}
          onConfirm={handleConfirm}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

// ── Tour Card ──────────────────────────────────────────────────────────────

interface TourCardProps {
  item: TourItem;
  canAct: boolean;
  onConfirm: (item: TourItem) => Promise<void>;
  onComplete: (item: TourItem) => Promise<void>;
  onCancel: (item: TourItem) => Promise<void>;
  compact?: boolean;
}

const TourCard = ({ item, canAct, onConfirm, onComplete, onCancel, compact }: TourCardProps) => {
  const [busy, setBusy] = useState(false);

  const isPending = item.status === 'pending';
  const isConfirmed = item.status === 'confirmed';

  const borderClass = isPending
    ? 'border-l-amber-400'
    : isConfirmed
      ? 'border-l-emerald-400'
      : 'border-l-blue-400';

  const act = async (fn: (item: TourItem) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(item); } finally { setBusy(false); }
  };

  const formattedDate = item.date
    ? (() => {
        try { return format(new Date(item.date + 'T00:00:00'), 'EEE, MMM d'); }
        catch { return item.date; }
      })()
    : null;

  return (
    <div
      className={`rounded-xl border border-border/60 border-l-4 ${borderClass} bg-card/90 backdrop-blur-sm ${
        isPending ? 'new-order-card' : ''
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Header: guest name + type badge */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm text-foreground tracking-wider truncate">{item.name}</p>
          <p className="font-body text-xs text-muted-foreground truncate mt-0.5">{item.guestName}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant="outline" className={`font-body text-[10px] h-5 ${STATUS_BADGE[item.status] || STATUS_BADGE.confirmed}`}>
            {item.status}
          </Badge>
          <span className="flex items-center gap-1 font-body text-[10px] text-muted-foreground">
            {TYPE_ICON[item.type]}
            {item.type}
          </span>
        </div>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
        {formattedDate && (
          <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {formattedDate}
          </span>
        )}
        {item.pickupTime && (
          <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {item.pickupTime}
          </span>
        )}
        {item.pax != null && (
          <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
            <Users className="w-3 h-3 flex-shrink-0" />
            {item.pax} pax
          </span>
        )}
      </div>

      {/* Price */}
      {item.price > 0 && (
        <p className="font-display text-base text-gold tabular-nums mb-2">
          ₱{item.price.toLocaleString()}
        </p>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="flex items-start gap-1.5 mb-3 bg-muted/40 rounded-lg px-2 py-1.5">
          <StickyNote className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="font-body text-[11px] text-muted-foreground line-clamp-2">{item.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-2 pt-2 border-t border-border/50">
          {isPending && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(onConfirm)}
                className="flex-1 font-display text-xs tracking-wider min-h-[40px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => act(onCancel)}
                className="font-display text-xs tracking-wider min-h-[40px] gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            </>
          )}
          {isConfirmed && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(onComplete)}
                className="flex-1 font-display text-xs tracking-wider min-h-[40px] gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Flag className="w-4 h-4" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => act(onCancel)}
                className="font-display text-xs tracking-wider min-h-[40px] gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Mobile Tab View ────────────────────────────────────────────────────────

interface MobileTourTabViewProps {
  columns: Record<ColKey, TourItem[]>;
  canAct: boolean;
  onConfirm: (item: TourItem) => Promise<void>;
  onComplete: (item: TourItem) => Promise<void>;
  onCancel: (item: TourItem) => Promise<void>;
}

const MobileTourTabView = ({ columns, canAct, onConfirm, onComplete, onCancel }: MobileTourTabViewProps) => {
  const [tab, setTab] = useState<ColKey>('pending');

  const TAB_PULSE: Record<ColKey, string> = {
    pending: columns.pending.length > 0 ? 'tab-pulse' : '',
    confirmed: '',
    today: '',
  };

  return (
    <div className="md:hidden flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        {(['pending', 'confirmed', 'today'] as ColKey[]).map(col => (
          <button
            key={col}
            onClick={() => setTab(col)}
            className={`font-display text-xs tracking-wider px-4 min-h-[48px] rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
              tab === col
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground border border-border'
            } ${tab !== col ? TAB_PULSE[col] : ''}`}
          >
            {COL_LABELS[col]}
            {columns[col].length > 0 && (
              <span className={`text-[11px] font-body font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                tab === col
                  ? 'bg-foreground/20 text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {columns[col].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
        {columns[tab]?.length === 0 && (
          <p className="font-body text-sm text-muted-foreground text-center py-12">
            No {COL_LABELS[tab].toLowerCase()} items
          </p>
        )}
        {columns[tab]?.map(item => (
          <TourCard
            key={`${item.source}-${item.id}`}
            item={item}
            canAct={canAct}
            onConfirm={onConfirm}
            onComplete={onComplete}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  );
};

export default ToursBoard;
