import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import WaitstaffOrderCard from './WaitstaffOrderCard';
import ServiceOrderDetail from './ServiceOrderDetail';
import { useResortProfile } from '@/hooks/useResortProfile';
import { getStaffSession } from '@/lib/session';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const COL_COLORS: Record<string, string> = {
  New: 'border-t-gold',
  Preparing: 'border-t-orange-400',
  Ready: 'border-t-emerald-400',
};

const KANBAN_COLS = ['New', 'Preparing', 'Ready'] as const;

const WaitstaffBoard = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: resortProfile } = useResortProfile();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [servedOpen, setServedOpen] = useState(false);
  const [closingTabId, setClosingTabId] = useState<string | null>(null);

  const permissions = useMemo(() => {
    const s = getStaffSession();
    return s?.permissions || [];
  }, []);

  // Audio unlock on first interaction
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

  // Chime at a distinct pitch for waitstaff notifications
  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.5);
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('service-board-waitstaff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['service-orders'] });
        qc.invalidateQueries({ queryKey: ['tab-orders-waitstaff'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' }, () => {
        qc.invalidateQueries({ queryKey: ['open-tabs-waitstaff'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Fetch active orders — shared query key with other service boards
  const { data: orders = [] } = useQuery({
    queryKey: ['service-orders'],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['New', 'Preparing', 'Ready', 'Served', 'Paid'])
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true })
        .limit(300);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch open tabs
  const { data: openTabs = [] } = useQuery({
    queryKey: ['open-tabs-waitstaff'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tabs')
        .select('*')
        .eq('status', 'Open')
        .order('created_at', { ascending: true });
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Fetch orders for open tabs (for running totals + order counts)
  const tabIds = useMemo(() => openTabs.map((t: any) => t.id), [openTabs]);
  const { data: tabOrders = [] } = useQuery({
    queryKey: ['tab-orders-waitstaff', tabIds],
    enabled: tabIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, tab_id, total, status, items')
        .in('tab_id', tabIds);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Running totals per tab
  const tabStats = useMemo(() => {
    const stats: Record<string, { total: number; orderCount: number }> = {};
    tabOrders.forEach((o: any) => {
      if (!o.tab_id) return;
      if (!stats[o.tab_id]) stats[o.tab_id] = { total: 0, orderCount: 0 };
      stats[o.tab_id].total += Number(o.total || 0);
      stats[o.tab_id].orderCount += 1;
    });
    return stats;
  }, [tabOrders]);

  // Group open tabs by location so same-table orders appear as one card
  const groupedOpenTabs = useMemo(() => {
    const groups = new Map<string, any[]>();
    openTabs.forEach((tab: any) => {
      const key = `${tab.location_type}||${tab.location_detail}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tab);
    });
    return Array.from(groups.values()).map(tabs => ({
      representative: tabs[0],
      allIds: tabs.map((t: any) => t.id),
    }));
  }, [openTabs]);

  // Close tab(s) → send to Cashier
  const handleCloseTab = async (tabIds: string[]) => {
    setClosingTabId(tabIds[0]);
    try {
      // Mark all open orders on these tabs as Served
      const ordersOnTab = tabOrders.filter((o: any) => tabIds.includes(o.tab_id) && o.status !== 'Paid');
      if (ordersOnTab.length > 0) {
        const orderIds = ordersOnTab.map((o: any) => o.id);
        await supabase.from('orders').update({ status: 'Served' }).in('id', orderIds);
      }
      // Close all tabs in the group
      await supabase.from('tabs').update({ status: 'Closed', closed_at: new Date().toISOString() }).in('id', tabIds);

      qc.invalidateQueries({ queryKey: ['open-tabs-waitstaff'] });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
      qc.invalidateQueries({ queryKey: ['cashier-orders'] });
      toast.success('Tab closed — sent to Cashier');
    } catch {
      toast.error('Failed to close tab');
    } finally {
      setClosingTabId(null);
    }
  };

  // Bucket into columns — all orders visible across departments
  const columns = useMemo(() => {
    const cols: Record<string, any[]> = { New: [], Preparing: [], Ready: [], Served: [] };
    orders.forEach((o: any) => {
      if (o.status === 'New') cols.New.push(o);
      else if (o.status === 'Preparing') cols.Preparing.push(o);
      else if (o.status === 'Ready') cols.Ready.push(o);
      else if (o.status === 'Served') cols.Served.push(o);
    });
    return cols;
  }, [orders]);

  // Play chime when new Ready orders appear
  const prevReadyCountRef = useRef(0);
  useEffect(() => {
    if (columns.Ready.length > prevReadyCountRef.current) {
      playChime();
    }
    prevReadyCountRef.current = columns.Ready.length;
  }, [columns.Ready.length, playChime]);

  // Action handler — waitstaff can only mark orders as served (send to cashier)
  const handleAction = async (orderId: string, action: string) => {
    if (action !== 'mark-served') return;
    const order = orders.find((o: any) => o.id === orderId);
    if (!order) return;
    await supabase.from('orders').update({ status: 'Served' }).eq('id', orderId);
    qc.invalidateQueries({ queryKey: ['service-orders'] });
    toast.success('Order sent to Cashier');
  };

  const totalActive =
    columns.New.length + columns.Preparing.length + columns.Ready.length;

  return (
    <div className="h-full flex flex-col">
      {/* Open Tabs section */}
      {groupedOpenTabs.length > 0 && (
        <div className="flex-shrink-0 border-b border-border bg-card/30 px-4 py-3 space-y-2">
          <p className="font-display text-xs tracking-wider text-muted-foreground">OPEN TABS ({groupedOpenTabs.length})</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {groupedOpenTabs.map(({ representative: tab, allIds }) => {
              const combinedTotal = allIds.reduce((sum: number, id: string) => sum + (tabStats[id]?.total || 0), 0);
              const combinedCount = allIds.reduce((sum: number, id: string) => sum + (tabStats[id]?.orderCount || 0), 0);
              const isClosing = !!closingTabId && allIds.includes(closingTabId);
              return (
                <div
                  key={tab.id}
                  className="flex-shrink-0 w-56 rounded-xl border border-border bg-card/90 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="font-display text-sm tracking-wider text-foreground truncate">
                        🪑 {tab.location_detail}
                      </p>
                      <p className="font-body text-xs text-muted-foreground truncate">
                        👤 {tab.guest_name || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {(() => {
                      const openedAt = new Date(tab.created_at);
                      return (
                        <p className="font-body text-[11px] text-muted-foreground">
                          🕐 {format(openedAt, 'h:mm a')} · {formatDistanceToNow(openedAt, { addSuffix: false })} ago
                        </p>
                      );
                    })()}
                    <div className="flex items-center justify-between">
                      <span className="font-body text-xs text-muted-foreground">{combinedCount} order{combinedCount !== 1 ? 's' : ''}</span>
                      <span className="font-display text-sm text-gold tabular-nums">₱{combinedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          mode: 'staff',
                          orderType: tab.location_type,
                          location: tab.location_detail,
                          guestName: tab.guest_name || '',
                          returnTo: '/service/waitstaff',
                        });
                        navigate(`/menu?${params.toString()}`);
                      }}
                      className="flex-1 min-h-[36px] rounded-lg bg-gold/10 border border-gold/40 text-gold font-display text-[11px] tracking-wider flex items-center justify-center gap-1 hover:bg-gold/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Order
                    </button>
                    <button
                      onClick={() => handleCloseTab(allIds)}
                      disabled={isClosing}
                      className="flex-1 min-h-[36px] rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-display text-[11px] tracking-wider flex items-center justify-center gap-1 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {isClosing ? '…' : <><X className="w-3 h-3" /> Close Tab</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-card/50 flex-shrink-0">
        <span className="font-display text-sm text-foreground tracking-wider">
          {totalActive} Active
        </span>
        {columns.New.length > 0 && (
          <span className="font-body text-xs text-gold font-bold blink-dot">
            {columns.New.length} NEW
          </span>
        )}
        {columns.Ready.length > 0 && (
          <span className="font-body text-xs text-emerald-400 font-bold animate-pulse">
            {columns.Ready.length} READY TO PICK UP
          </span>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-auto">
        {/* Desktop/Tablet: horizontal kanban */}
        <div className="hidden md:grid gap-3 p-4 md:grid-cols-3">
          {KANBAN_COLS.map(col => (
            <div
              key={col}
              className={`flex flex-col border-t-4 ${COL_COLORS[col]} rounded-t-lg bg-secondary/30`}
            >
              <div className="px-3 py-2 flex items-center justify-between">
                <h3 className="font-display text-sm tracking-wider text-foreground">{col}</h3>
                <span className="font-body text-xs text-muted-foreground font-bold bg-muted rounded-full w-6 h-6 flex items-center justify-center">
                  {columns[col].length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 max-h-[60vh]">
                {columns[col].map((order: any) => (
                  <WaitstaffOrderCard
                    key={order.id}
                    order={order}
                    onAction={handleAction}
                    onOpenDetail={setDetailOrder}
                    compact
                  />
                ))}
                {columns[col].length === 0 && (
                  <p className="font-body text-xs text-muted-foreground text-center py-8">
                    No orders
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Served (collapsible) — Desktop */}
        {columns.Served.length > 0 && (
          <div className="hidden md:block px-4 pb-4">
            <Collapsible open={servedOpen} onOpenChange={setServedOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3 hover:bg-secondary transition-colors">
                <span className="font-display text-sm tracking-wider text-muted-foreground">
                  ✓ Sent to Cashier Today ({columns.Served.length})
                </span>
                {servedOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="grid gap-3 max-h-[40vh] overflow-y-auto grid-cols-3">
                  {columns.Served.map((order: any) => (
                    <WaitstaffOrderCard
                      key={order.id}
                      order={order}
                      onOpenDetail={setDetailOrder}
                      compact
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Mobile: tabbed view */}
        <MobileTabView
          columns={columns}
          onAction={handleAction}
          onOpenDetail={setDetailOrder}
        />
      </div>

      {/* Detail drawer — read-only for waitstaff (no kitchen/bar actions) */}
      <ServiceOrderDetail
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(open) => { if (!open) setDetailOrder(null); }}
        permissions={permissions}
        department="waitstaff"
        onAction={async () => {}}
        resortProfile={resortProfile}
      />
    </div>
  );
};

/** Mobile tab-based view */
const MobileTabView = ({
  columns,
  onAction,
  onOpenDetail,
}: {
  columns: Record<string, any[]>;
  onAction: (orderId: string, action: string) => Promise<void>;
  onOpenDetail: (order: any) => void;
}) => {
  const [tab, setTab] = useState<string>('New');
  const [servedOpen, setServedOpen] = useState(false);
  const MOBILE_TABS = ['New', 'Preparing', 'Ready'] as const;

  return (
    <div className="md:hidden flex flex-col h-full">
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        {MOBILE_TABS.map(col => (
          <button
            key={col}
            onClick={() => setTab(col)}
            className={`font-display text-xs tracking-wider px-4 min-h-[48px] rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
              tab === col
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground border border-border'
            } ${col === 'Ready' && columns.Ready.length > 0 && tab !== col ? 'animate-pulse' : ''}`}
          >
            {col}
            {columns[col].length > 0 && (
              <span
                className={`text-[11px] font-body font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                  tab === col ? 'bg-foreground/20 text-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {columns[col].length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
        {columns[tab]?.length === 0 && (
          <p className="font-body text-sm text-muted-foreground text-center py-12">
            No {tab.toLowerCase()} orders
          </p>
        )}
        {columns[tab]?.map((order: any) => (
          <WaitstaffOrderCard
            key={order.id}
            order={order}
            onAction={onAction}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>

      {/* Served collapsible — Mobile */}
      {columns.Served.length > 0 && (
        <div className="px-3 pb-4 flex-shrink-0">
          <Collapsible open={servedOpen} onOpenChange={setServedOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3">
              <span className="font-display text-xs tracking-wider text-muted-foreground">
                ✓ Sent to Cashier ({columns.Served.length})
              </span>
              {servedOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3 max-h-[40vh] overflow-y-auto">
              {columns.Served.map((order: any) => (
                <WaitstaffOrderCard
                  key={order.id}
                  order={order}
                  onOpenDetail={onOpenDetail}
                  compact
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
};

export default WaitstaffBoard;
