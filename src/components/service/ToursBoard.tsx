import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, isFuture, parseISO, startOfDay } from 'date-fns';
import { Palmtree, Car, Bike, CalendarDays, Clock, Users, StickyNote, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getStaffSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemKind = 'tour' | 'transport' | 'rental';
type ItemStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
type DateFilter = 'today' | 'upcoming' | 'all';
type TypeFilter = 'all' | 'tours' | 'transport' | 'rentals';

interface BoardItem {
  id: string;
  kind: ItemKind;
  guestName: string;
  itemName: string;
  date: string | null;      // tour_date (YYYY-MM-DD) for bookings, null for requests
  pax: number | null;
  pickupTime: string | null;
  price: number;
  notes: string | null;
  details: string | null;   // raw details field from guest_requests
  status: ItemStatus;
  createdAt: string;
}

// ─── Styling constants (match WaitstaffBoard) ─────────────────────────────────

const COL_COLORS: Record<string, string> = {
  pending:   'border-t-amber-400',
  confirmed: 'border-t-emerald-400',
  completed: 'border-t-muted',
};

const COL_LABELS: Record<string, string> = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

const STATUS_BORDER: Record<ItemStatus, string> = {
  pending:   'border-l-amber-400',
  confirmed: 'border-l-emerald-400',
  completed: 'border-l-border',
  cancelled: 'border-l-red-500',
};

const STATUS_BADGE: Record<ItemStatus, string> = {
  pending:   'bg-amber-500/20 text-amber-400 border-amber-500/40',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/40',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSession = () => {
  const s = getStaffSession();
  return { name: s?.name || 'Staff', perms: s?.permissions || [], isAdmin: s?.permissions?.includes('admin') ?? false };
};

const parsePriceFromDetails = (details: string): number => {
  const match = details?.match(/₱([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
};

const kindIcon = (kind: ItemKind) => {
  if (kind === 'tour') return <Palmtree className="w-3.5 h-3.5 text-primary flex-shrink-0" />;
  if (kind === 'transport') return <Car className="w-3.5 h-3.5 text-primary flex-shrink-0" />;
  return <Bike className="w-3.5 h-3.5 text-primary flex-shrink-0" />;
};

type TourBookingRow = {
  id: string;
  tour_name: string;
  tour_date: string;
  pax: number;
  pickup_time: string;
  price: number;
  notes: string;
  status: string;
  guest_name: string;
  created_at: string;
};

type GuestRequestRow = {
  id: string;
  request_type: string;
  details: string;
  status: string;
  guest_name: string;
  created_at: string;
};

/** Normalise tour_bookings row → BoardItem */
const normTourBooking = (b: TourBookingRow): BoardItem => ({
  id: `tb-${b.id}`,
  kind: 'tour',
  guestName: b.guest_name || '',
  itemName: b.tour_name || 'Tour',
  date: b.tour_date || null,
  pax: b.pax ?? null,
  pickupTime: b.pickup_time || null,
  price: Number(b.price) || 0,
  notes: b.notes || null,
  details: null,
  status: (b.status as ItemStatus) || 'pending',
  createdAt: b.created_at,
});

/** Normalise guest_requests row → BoardItem */
const normRequest = (r: GuestRequestRow): BoardItem => ({
  id: `req-${r.id}`,
  kind: r.request_type?.toLowerCase().includes('transport') ? 'transport' : 'rental',
  guestName: r.guest_name || '',
  itemName: r.request_type || 'Request',
  date: null,
  pax: null,
  pickupTime: null,
  price: parsePriceFromDetails(r.details || ''),
  notes: null,
  details: r.details || null,
  status: (r.status as ItemStatus) || 'pending',
  createdAt: r.created_at,
});

/** True when the item's effective date is today */
const isItemToday = (item: BoardItem): boolean => {
  if (item.date) {
    try { return isToday(parseISO(item.date)); } catch { return false; }
  }
  try { return isToday(parseISO(item.createdAt)); } catch { return false; }
};

/** True when the item's effective date is strictly in the future */
const isItemUpcoming = (item: BoardItem): boolean => {
  if (item.date) {
    try { return isFuture(startOfDay(parseISO(item.date))); } catch { return false; }
  }
  return false;
};

// ─── Main component ──────────────────────────────────────────────────────────

const ToursBoard = () => {
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevPendingCountRef = useRef(0);

  // ── Permissions ──
  const { name: staffName, perms, isAdmin } = useMemo(getSession, []);
  const canAct = isAdmin || canEdit(perms, 'experiences') || canEdit(perms, 'reception');

  // ── Audio ──
  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.2);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1108.73, now + 0.2);
    osc2.connect(gain);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.5);
  }, []);

  useEffect(() => {
    const WebkitAC = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const AC = window.AudioContext ?? WebkitAC;
    const unlock = async () => {
      if (!audioCtxRef.current && AC) {
        audioCtxRef.current = new AC();
      }
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  // ── Data fetching ──
  const { data: rawBookings = [] } = useQuery({
    queryKey: ['tours-board-bookings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tour_bookings')
        .select('*')
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('tour_date', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as TourBookingRow[];
    },
    refetchInterval: 15000,
  });

  const { data: rawRequests = [] } = useQuery({
    queryKey: ['tours-board-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('guest_requests')
        .select('*')
        .in('request_type', ['Transport', 'Rental'])
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as GuestRequestRow[];
    },
    refetchInterval: 15000,
  });

  // ── Realtime subscriptions ──
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

  // ── Normalise into unified list ──
  const allItems = useMemo<BoardItem[]>(() => {
    const bookings = rawBookings.map(normTourBooking);
    const requests = rawRequests.map(normRequest);
    return [...bookings, ...requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [rawBookings, rawRequests]);

  // ── Chime on new pending ──
  useEffect(() => {
    const pendingCount = allItems.filter(i => i.status === 'pending').length;
    if (pendingCount > prevPendingCountRef.current) {
      playChime();
    }
    prevPendingCountRef.current = pendingCount;
  }, [allItems, playChime]);

  // ── Apply filters ──
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Date filter
      if (dateFilter === 'today' && !isItemToday(item)) return false;
      if (dateFilter === 'upcoming' && !isItemUpcoming(item)) return false;
      // Type filter
      if (typeFilter === 'tours' && item.kind !== 'tour') return false;
      if (typeFilter === 'transport' && item.kind !== 'transport') return false;
      if (typeFilter === 'rentals' && item.kind !== 'rental') return false;
      return true;
    });
  }, [allItems, dateFilter, typeFilter]);

  const columns = useMemo(() => ({
    pending:   filteredItems.filter(i => i.status === 'pending'),
    confirmed: filteredItems.filter(i => i.status === 'confirmed'),
    completed: filteredItems.filter(i => i.status === 'completed'),
  }), [filteredItems]);

  // ── Actions ──
  const confirmItem = useCallback(async (item: BoardItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    const rawId = item.id.replace(/^(tb-|req-)/, '');
    try {
      if (item.kind === 'tour') {
        const { error } = await supabase.from('tour_bookings').update({ status: 'confirmed', confirmed_by: staffName }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        const { error } = await supabase.from('guest_requests').update({ status: 'confirmed', confirmed_by: staffName }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Confirmed');
    } catch {
      toast.error('Failed to confirm — please try again');
    }
  }, [canAct, staffName, qc]);

  const completeItem = useCallback(async (item: BoardItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    const rawId = item.id.replace(/^(tb-|req-)/, '');
    try {
      if (item.kind === 'tour') {
        const { error } = await supabase.from('tour_bookings').update({ status: 'completed' }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        const { error } = await supabase.from('guest_requests').update({ status: 'completed' }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Completed');
    } catch {
      toast.error('Failed to complete — please try again');
    }
  }, [canAct, qc]);

  const cancelItem = useCallback(async (item: BoardItem) => {
    if (!canAct) { toast.error('View-only access'); return; }
    const rawId = item.id.replace(/^(tb-|req-)/, '');
    try {
      if (item.kind === 'tour') {
        const { error } = await supabase.from('tour_bookings').update({ status: 'cancelled' }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-bookings'] });
      } else {
        const { error } = await supabase.from('guest_requests').update({ status: 'cancelled' }).eq('id', rawId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['tours-board-requests'] });
      }
      toast.success('Cancelled');
    } catch {
      toast.error('Failed to cancel — please try again');
    }
  }, [canAct, qc]);

  const totalActive = columns.pending.length + columns.confirmed.length;

  return (
    <div className="h-full flex flex-col">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card/50 flex-shrink-0">
        {/* Date filters */}
        {(['all', 'today', 'upcoming'] as const).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`font-display text-xs tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap transition-colors capitalize ${
              dateFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {f === 'all' ? 'All Dates' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-border">|</span>
        {/* Type filters */}
        {(['all', 'tours', 'transport', 'rentals'] as const).map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`font-display text-xs tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap transition-colors capitalize ${
              typeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="font-body text-xs text-muted-foreground ml-auto">{totalActive} active</span>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Desktop: 3-column kanban */}
        <div className="hidden md:grid gap-3 p-4 md:grid-cols-3">
          {(['pending', 'confirmed'] as const).map(col => (
            <KanbanColumn
              key={col}
              col={col}
              items={columns[col]}
              canAct={canAct}
              onConfirm={confirmItem}
              onComplete={completeItem}
              onCancel={cancelItem}
            />
          ))}
          {/* Completed column — collapsible, third slot on desktop */}
          <CompletedColumn items={columns.completed} />
        </div>

        {/* Mobile: tab switcher */}
        <MobileTabView
          columns={columns}
          canAct={canAct}
          onConfirm={confirmItem}
          onComplete={completeItem}
          onCancel={cancelItem}
        />
      </div>
    </div>
  );
};

// ─── Kanban Column ────────────────────────────────────────────────────────────

const KanbanColumn = ({ col, items, canAct, onConfirm, onComplete, onCancel }: {
  col: 'pending' | 'confirmed';
  items: BoardItem[];
  canAct: boolean;
  onConfirm: (i: BoardItem) => Promise<void>;
  onComplete: (i: BoardItem) => Promise<void>;
  onCancel: (i: BoardItem) => Promise<void>;
}) => (
  <div className={`flex flex-col border-t-4 ${COL_COLORS[col]} rounded-t-lg bg-secondary/30`}>
    <div className="px-3 py-2 flex items-center justify-between">
      <h3 className="font-display text-sm tracking-wider text-foreground">{COL_LABELS[col]}</h3>
      <span className="font-body text-xs text-muted-foreground font-bold bg-muted rounded-full w-6 h-6 flex items-center justify-center">
        {items.length}
      </span>
    </div>
    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 max-h-[60vh]">
      {items.map(item => (
        <ItemCard key={item.id} item={item} canAct={canAct} onConfirm={onConfirm} onComplete={onComplete} onCancel={onCancel} compact />
      ))}
      {items.length === 0 && (
        <p className="font-body text-xs text-muted-foreground text-center py-8">No {col} items</p>
      )}
    </div>
  </div>
);

// ─── Completed Column ─────────────────────────────────────────────────────────

const CompletedColumn = ({ items }: { items: BoardItem[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`flex flex-col border-t-4 border-t-border rounded-t-lg bg-secondary/30`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="px-3 py-2 flex items-center justify-between">
          <h3 className="font-display text-sm tracking-wider text-muted-foreground">{COL_LABELS.completed}</h3>
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-muted-foreground font-bold bg-muted rounded-full w-6 h-6 flex items-center justify-center">
              {items.length}
            </span>
            <CollapsibleTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-2 max-h-[55vh] overflow-y-auto">
            {items.map(item => (
              <ItemCard key={item.id} item={item} canAct={false} onConfirm={async () => {}} onComplete={async () => {}} onCancel={async () => {}} compact />
            ))}
            {items.length === 0 && (
              <p className="font-body text-xs text-muted-foreground text-center py-8">No completed items</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// ─── Item Card ────────────────────────────────────────────────────────────────

const ItemCard = ({ item, canAct, onConfirm, onComplete, onCancel, compact }: {
  item: BoardItem;
  canAct: boolean;
  onConfirm: (i: BoardItem) => Promise<void>;
  onComplete: (i: BoardItem) => Promise<void>;
  onCancel: (i: BoardItem) => Promise<void>;
  compact?: boolean;
}) => {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const borderClass = STATUS_BORDER[item.status];
  const isPending = item.status === 'pending';
  const isConfirmed = item.status === 'confirmed';

  return (
    <div className={`rounded-xl border border-border/60 border-l-4 ${borderClass} bg-card/90 backdrop-blur-sm ${
      isPending ? 'new-order-card' : ''
    } ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {kindIcon(item.kind)}
          <p className="font-display text-sm text-foreground tracking-wider truncate">{item.itemName}</p>
        </div>
        <Badge className={`font-body text-[10px] flex-shrink-0 ${STATUS_BADGE[item.status]}`}>
          {item.status}
        </Badge>
      </div>

      {/* Guest name */}
      <p className="font-body text-xs text-muted-foreground mb-2 truncate">{item.guestName}</p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
        {item.date && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="w-3 h-3 flex-shrink-0" />
            <span className="font-body text-xs">
              {format(parseISO(item.date + 'T00:00:00'), 'EEE, MMM d')}
            </span>
          </div>
        )}
        {item.pickupTime && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="font-body text-xs">{item.pickupTime}</span>
          </div>
        )}
        {item.pax != null && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span className="font-body text-xs">{item.pax} pax</span>
          </div>
        )}
        {item.price > 0 && (
          <span className="font-display text-sm text-gold tabular-nums">
            ₱{item.price.toLocaleString()}
          </span>
        )}
      </div>

      {/* Details / notes */}
      {item.details && (
        <p className="font-body text-[11px] text-muted-foreground mb-2 line-clamp-2">{item.details}</p>
      )}
      {item.notes && (
        <div className="flex items-start gap-1 mb-2">
          <StickyNote className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="font-body text-[11px] text-amber-400/80 italic line-clamp-2">{item.notes}</p>
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
                onClick={() => run(() => onConfirm(item))}
                className="font-display text-xs tracking-wider min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Confirm
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onCancel(item))}
                variant="destructive"
                className="font-display text-xs tracking-wider min-h-[36px]"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}
          {isConfirmed && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onComplete(item))}
                className="font-display text-xs tracking-wider min-h-[36px] bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Complete
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onCancel(item))}
                variant="destructive"
                className="font-display text-xs tracking-wider min-h-[36px]"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Mobile Tab View ──────────────────────────────────────────────────────────

const MobileTabView = ({ columns, canAct, onConfirm, onComplete, onCancel }: {
  columns: { pending: BoardItem[]; confirmed: BoardItem[]; completed: BoardItem[] };
  canAct: boolean;
  onConfirm: (i: BoardItem) => Promise<void>;
  onComplete: (i: BoardItem) => Promise<void>;
  onCancel: (i: BoardItem) => Promise<void>;
}) => {
  const [tab, setTab] = useState<'pending' | 'confirmed' | 'completed'>('pending');
  const [completedOpen, setCompletedOpen] = useState(false);

  const TABS = ['pending', 'confirmed', 'completed'] as const;

  return (
    <div className="md:hidden flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-display text-xs tracking-wider px-4 min-h-[48px] rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors capitalize ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground border border-border'
            } ${t === 'pending' && columns.pending.length > 0 && tab !== t ? 'tab-pulse' : ''}`}
          >
            {COL_LABELS[t]}
            {columns[t].length > 0 && (
              <span className={`text-[11px] font-body font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                tab === t ? 'bg-foreground/20 text-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {columns[t].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
        {tab !== 'completed' && (
          <>
            {columns[tab].length === 0 && (
              <p className="font-body text-sm text-muted-foreground text-center py-12">
                No {tab} items
              </p>
            )}
            {columns[tab].map(item => (
              <ItemCard key={item.id} item={item} canAct={canAct} onConfirm={onConfirm} onComplete={onComplete} onCancel={onCancel} />
            ))}
          </>
        )}

        {tab === 'completed' && (
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3">
              <span className="font-display text-xs tracking-wider text-muted-foreground">
                ✓ Completed ({columns.completed.length})
              </span>
              {completedOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {columns.completed.length === 0 && (
                <p className="font-body text-sm text-muted-foreground text-center py-8">No completed items</p>
              )}
              {columns.completed.map(item => (
                <ItemCard key={item.id} item={item} canAct={false} onConfirm={async () => {}} onComplete={async () => {}} onCancel={async () => {}} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

export default ToursBoard;
