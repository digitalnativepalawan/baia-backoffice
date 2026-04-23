import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { getStaffSession } from '@/lib/session';
import { toast } from 'sonner';
import { useResortProfile } from '@/hooks/useResortProfile';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, Home, ChevronDown, ChevronUp, CreditCard, Check, ArrowLeft, Printer, CalendarIcon, BedDouble, Receipt } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow, format } from 'date-fns';
import CashierReceipt from './CashierReceipt';

const CashierBoard = () => {
  const qc = useQueryClient();
  const { data: resortProfile } = useResortProfile();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedTabBill, setSelectedTabBill] = useState<any | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedDate, setCompletedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGroup, setSelectedGroup] = useState<any[] | null>(null);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('cashier-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['cashier-orders'] });
        qc.invalidateQueries({ queryKey: ['cashier-completed'] });
        qc.invalidateQueries({ queryKey: ['cashier-tab-orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' }, () => {
        qc.invalidateQueries({ queryKey: ['cashier-tab-bills'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Fetch today's closed tab bills (unpaid)
  const { data: tabBills = [] } = useQuery({
    queryKey: ['cashier-tab-bills'],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('tabs')
        .select('*')
        .eq('status', 'Closed')
        .is('payment_method', null)
        .gte('closed_at', start.toISOString())
        .order('closed_at', { ascending: true });
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch orders for closed tab bills
  const tabBillIds = useMemo(() => tabBills.map((t: any) => t.id), [tabBills]);
  const { data: tabBillOrders = [] } = useQuery({
    queryKey: ['cashier-tab-orders', tabBillIds],
    enabled: tabBillIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .in('tab_id', tabBillIds);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch today's Served orders — exclude those belonging to closed tab bills
  const { data: orders = [] } = useQuery({
    queryKey: ['cashier-orders'],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['Ready', 'Served'])
        .neq('payment_type', 'Charge to Room')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true })
        .limit(300);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch completed orders for selected date
  const { data: completedOrders = [] } = useQuery({
    queryKey: ['cashier-completed', completedDate],
    queryFn: async () => {
      const dayStart = `${completedDate}T00:00:00`;
      const dayEnd = `${completedDate}T23:59:59`;
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'Paid')
        .is('room_id', null)
        .neq('payment_type', 'Charge to Room')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false })
        .limit(300);
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Active bookings for charge-to-room
  const { data: activeBookings = [] } = useQuery({
    queryKey: ['cashier-active-bookings'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('resort_ops_bookings')
        .select('id, check_in, check_out, unit_id, guest_id, resort_ops_guests(full_name), resort_ops_units:unit_id(name)')
        .lte('check_in', today)
        .gte('check_out', today)
        .limit(50);
      return (data || []) as any[];
    },
  });

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    if (!selectedOrder || busy) return;
    const paymentType = chargeToRoom ? 'Charge to Room' : selectedPayment;
    if (!paymentType) return;

    setBusy(true);
    try {
      const updateData: any = {
        status: 'Paid',
        payment_type: paymentType,
        closed_at: new Date().toISOString(),
      };

      let roomBooking: any = null;
      if (chargeToRoom && selectedBooking) {
        roomBooking = activeBookings.find(b => b.id === selectedBooking);
        if (roomBooking?.unit_id) {
          updateData.room_id = roomBooking.unit_id;
        }
      }

      await supabase.from('orders').update(updateData).eq('id', selectedOrder.id);

      // Create room_transaction so the charge appears on the guest's folio
      if (chargeToRoom && roomBooking) {
        const staffSession = getStaffSession();
        const items = (selectedOrder.items as any[]) || [];
        const subtotal = items.reduce((s: number, i: any) => s + i.price * (i.qty || i.quantity || 1), 0);
        const taxDetails = (selectedOrder.tax_details as any) || {};
        const taxAmount = Number(taxDetails.vat_amount ?? 0);
        const serviceCharge = Number(selectedOrder.service_charge ?? 0);
        const grandTotal = Number(selectedOrder.total ?? subtotal + taxAmount + serviceCharge);

        await (supabase.from('room_transactions' as any) as any).insert({
          unit_id: roomBooking.unit_id,
          unit_name: roomBooking.resort_ops_units?.name || '',
          booking_id: roomBooking.id,
          guest_name: roomBooking.resort_ops_guests?.full_name || selectedOrder.guest_name || null,
          transaction_type: 'room_charge',
          order_id: selectedOrder.id,
          amount: subtotal,
          tax_amount: taxAmount,
          service_charge_amount: serviceCharge,
          total_amount: grandTotal,
          payment_method: 'Charge to Room',
          staff_name: staffSession?.name || 'Staff',
          notes: `Room Folio – Order: ${items.map((i: any) => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ')}`,
        });
      }

      setReceiptOrder({ ...selectedOrder, payment_type: paymentType });
      setSelectedOrder(null);
      setSelectedPayment('');
      setChargeToRoom(false);
      setSelectedBooking(null);

      qc.invalidateQueries({ queryKey: ['cashier-orders'] });
      toast.success('Payment confirmed');
    } finally {
      setBusy(false);
    }
  };

  // Handle payment for a grouped set of orders
  const handleConfirmGroupPayment = async () => {
    if (!selectedGroup || selectedGroup.length === 0 || busy) return;
    const paymentType = chargeToRoom ? 'Charge to Room' : selectedPayment;
    if (!paymentType) return;

    setBusy(true);
    try {
      const updateData: any = {
        status: 'Paid',
        payment_type: paymentType,
        closed_at: new Date().toISOString(),
      };

      let roomBooking: any = null;
      if (chargeToRoom && selectedBooking) {
        roomBooking = activeBookings.find(b => b.id === selectedBooking);
        if (roomBooking?.unit_id) {
          updateData.room_id = roomBooking.unit_id;
        }
      }

      const orderIds = selectedGroup.map(o => o.id);
      await supabase.from('orders').update(updateData).in('id', orderIds);

      if (chargeToRoom && roomBooking) {
        const staffSession = getStaffSession();
        for (const order of selectedGroup) {
          const items = (order.items as any[]) || [];
          const subtotal = items.reduce((s: number, i: any) => s + i.price * (i.qty || i.quantity || 1), 0);
          const taxDetails = (order.tax_details as any) || {};
          const taxAmount = Number(taxDetails.vat_amount ?? 0);
          const serviceCharge = Number(order.service_charge ?? 0);
          const grandTotal = Number(order.total ?? subtotal + taxAmount + serviceCharge);

          await (supabase.from('room_transactions' as any) as any).insert({
            unit_id: roomBooking.unit_id,
            unit_name: roomBooking.resort_ops_units?.name || '',
            booking_id: roomBooking.id,
            guest_name: roomBooking.resort_ops_guests?.full_name || order.guest_name || null,
            transaction_type: 'room_charge',
            order_id: order.id,
            amount: subtotal,
            tax_amount: taxAmount,
            service_charge_amount: serviceCharge,
            total_amount: grandTotal,
            payment_method: 'Charge to Room',
            staff_name: staffSession?.name || 'Staff',
            notes: `Room Folio – Order: ${items.map((i: any) => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ')}`,
          });
        }
      }

      setSelectedGroup(null);
      setSelectedPayment('');
      setChargeToRoom(false);
      setSelectedBooking(null);

      qc.invalidateQueries({ queryKey: ['cashier-orders'] });
      toast.success('Payment confirmed');
    } finally {
      setBusy(false);
    }
  };

  // Filter individual orders: exclude those belonging to closed tab bills
  const filteredOrders = useMemo(() => {
    const closedTabIdSet = new Set(tabBillIds);
    return orders.filter((o: any) => !o.tab_id || !closedTabIdSet.has(o.tab_id));
  }, [orders, tabBillIds]);

  // Group filtered orders: by room_id → tab_id → location_detail → individual
  const groupedOrders = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const order of filteredOrders) {
      let key: string;
      if (order.room_id) {
        key = `room:${order.room_id}`;
      } else if (order.tab_id) {
        key = `tab:${order.tab_id}`;
      } else if (order.location_detail) {
        key = `loc:${order.location_detail}`;
      } else {
        key = `solo:${order.id}`;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    }
    return Array.from(map.values());
  }, [filteredOrders]);

  const activePaymentMethods = paymentMethods.filter(m => m.is_active && m.name !== 'Charge to Room');

  // Handle tab bill payment
  const handleConfirmTabPayment = async (tabBill: any, paymentMethod: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const ordersForTab = tabBillOrders.filter((o: any) => o.tab_id === tabBill.id);
      if (ordersForTab.length > 0) {
        const orderIds = ordersForTab.map((o: any) => o.id);
        await supabase.from('orders').update({ status: 'Paid', payment_type: paymentMethod, closed_at: new Date().toISOString() }).in('id', orderIds);
      }
      await supabase.from('tabs').update({ payment_method: paymentMethod }).eq('id', tabBill.id);

      qc.invalidateQueries({ queryKey: ['cashier-tab-bills'] });
      qc.invalidateQueries({ queryKey: ['cashier-tab-orders'] });
      qc.invalidateQueries({ queryKey: ['cashier-completed'] });
      setSelectedTabBill(null);
      setSelectedPayment('');
      toast.success('Tab settled');
    } catch {
      toast.error('Failed to settle tab');
    } finally {
      setBusy(false);
    }
  };

  const handleOrderSelect = useCallback((order: any) => {
    if (order.status === 'Paid') {
      setReceiptOrder(order);
    } else {
      setSelectedOrder(order);
      setSelectedGroup(null);
      setSelectedTabBill(null);
      setChargeToRoom(false);
      setSelectedPayment('');
      setSelectedBooking(null);
    }
  }, []);

  const handleGroupSelect = useCallback((groupOrders: any[]) => {
    if (groupOrders.length === 1) {
      handleOrderSelect(groupOrders[0]);
    } else {
      setSelectedGroup(groupOrders);
      setSelectedOrder(null);
      setSelectedTabBill(null);
      setChargeToRoom(false);
      setSelectedPayment('');
      setSelectedBooking(null);
    }
  }, [handleOrderSelect]);

  // Auto-detect in-stay guest for the selected order
  const selectedOrderInStay = useMemo(() => {
    if (!selectedOrder) return null;
    if (selectedOrder.room_id) {
      return activeBookings.find((b: any) => b.unit_id === selectedOrder.room_id) || null;
    }
    if (selectedOrder.guest_name) {
      const name = selectedOrder.guest_name.toLowerCase().trim();
      return activeBookings.find((b: any) => {
        const guestName = b.resort_ops_guests?.full_name?.toLowerCase()?.trim();
        return guestName && guestName === name;
      }) || null;
    }
    return null;
  }, [selectedOrder, activeBookings]);

  // Auto-detect in-stay guest for selected group
  const selectedGroupInStay = useMemo(() => {
    if (!selectedGroup || selectedGroup.length === 0) return null;
    const firstOrder = selectedGroup[0];
    if (firstOrder.room_id) {
      return activeBookings.find((b: any) => b.unit_id === firstOrder.room_id) || null;
    }
    if (firstOrder.guest_name) {
      const name = firstOrder.guest_name.toLowerCase().trim();
      return activeBookings.find((b: any) => {
        const guestName = b.resort_ops_guests?.full_name?.toLowerCase()?.trim();
        return guestName && guestName === name;
      }) || null;
    }
    return null;
  }, [selectedGroup, activeBookings]);

  // Receipt view
  if (receiptOrder) {
    return <CashierReceipt order={receiptOrder} onDone={() => setReceiptOrder(null)} />;
  }

  return (
    <div className="min-h-0 flex flex-col md:flex-row md:h-full md:overflow-hidden max-w-full">
      {/* Left: Order list */}
      <div className="flex-1 flex flex-col md:overflow-hidden border-r border-border/50 min-w-0">
        {/* Summary */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <span className="font-display text-sm text-foreground tracking-wider">
            {groupedOrders.length} bill{groupedOrders.length !== 1 ? 's' : ''} awaiting settlement
            {tabBills.length > 0 && (
              <span className="ml-2 text-emerald-400">· {tabBills.length} tab bill{tabBills.length !== 1 ? 's' : ''}</span>
            )}
          </span>
        </div>

        <div className="flex-1 md:overflow-y-auto">
          {/* Tab Bills section */}
          {tabBills.length > 0 && (
            <div className="p-3 space-y-2 border-b border-border/50">
              <p className="font-display text-xs tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> TAB BILLS
              </p>
              {tabBills.map((tab: any) => {
                const ordersForTab = tabBillOrders.filter((o: any) => o.tab_id === tab.id);
                const allItems: any[] = ordersForTab.flatMap((o: any) => (o.items as any[]) || []);
                const tabTotal = ordersForTab.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
                return (
                  <div
                    key={tab.id}
                    onClick={() => { setSelectedTabBill(tab); setSelectedOrder(null); setSelectedPayment(''); }}
                    className={`rounded-xl border p-3 cursor-pointer transition-all active:scale-[0.98] ${
                      selectedTabBill?.id === tab.id
                        ? 'ring-2 ring-emerald-500 bg-emerald-500/5 border-emerald-500/40'
                        : 'border-emerald-500/20 bg-card/90 hover:bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="min-w-0">
                        <p className="font-display text-sm text-foreground tracking-wider truncate">
                          🪑 {tab.location_detail}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          👤 {tab.guest_name || '—'} · 🕐 {tab.closed_at ? format(new Date(tab.closed_at), 'h:mm a') : '—'}
                        </p>
                      </div>
                      <span className="font-display text-sm text-emerald-400 tabular-nums ml-2">₱{tabTotal.toLocaleString()}</span>
                    </div>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {ordersForTab.length} order{ordersForTab.length !== 1 ? 's' : ''} · {allItems.length} item{allItems.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grouped list of served orders */}
          {groupedOrders.length > 0 ? (
            <div className="p-3 space-y-2">
              {groupedOrders.map(group => {
                const firstOrder = group[0];
                const groupOrderIds = group.map((o: any) => o.id).sort().join(',');
                const selectedGroupIds = (selectedGroup ?? []).map((o: any) => o.id).sort().join(',');
                const isSelected = group.length === 1
                  ? selectedOrder?.id === firstOrder.id
                  : selectedGroup !== null && groupOrderIds === selectedGroupIds;
                return (
                  <GroupedOrderRow
                    key={firstOrder.id}
                    groupOrders={group}
                    selected={isSelected}
                    onSelect={() => handleGroupSelect(group)}
                    activeBookings={activeBookings}
                  />
                );
              })}
            </div>
          ) : tabBills.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground text-center py-12">No orders awaiting settlement</p>
          ) : null}

          {/* Completed — date picker + stacked cards */}
          <div className="px-3 pb-4">
            <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3 hover:bg-secondary transition-colors">
                <span className="font-display text-xs tracking-wider text-muted-foreground">
                  ✓ Completed ({completedOrders.length})
                </span>
                {completedOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="date"
                    value={completedDate}
                    onChange={e => setCompletedDate(e.target.value || format(new Date(), 'yyyy-MM-dd'))}
                    className="bg-secondary border-border text-foreground font-body text-sm h-9 w-auto"
                  />
                </div>
                {completedOrders.length === 0 && (
                  <p className="font-body text-xs text-muted-foreground text-center py-4">No completed orders for this date</p>
                )}
                {completedOrders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={false}
                    onSelect={() => handleOrderSelect(order)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Right: Payment Panel */}
      <div className="w-full md:w-[400px] lg:w-[440px] flex-shrink-0 bg-card/50 flex flex-col md:overflow-y-auto">
        {selectedTabBill ? (
          <TabBillPanel
            tab={selectedTabBill}
            orders={tabBillOrders.filter((o: any) => o.tab_id === selectedTabBill.id)}
            paymentMethods={activePaymentMethods}
            selectedPayment={selectedPayment}
            onSelectPayment={setSelectedPayment}
            onConfirm={() => handleConfirmTabPayment(selectedTabBill, selectedPayment)}
            busy={busy}
            onBack={() => { setSelectedTabBill(null); setSelectedPayment(''); }}
          />
        ) : selectedGroup ? (
          <GroupedBillOutPanel
            groupOrders={selectedGroup}
            paymentMethods={activePaymentMethods}
            selectedPayment={selectedPayment}
            onSelectPayment={(p) => { setSelectedPayment(p); setChargeToRoom(false); }}
            chargeToRoom={chargeToRoom}
            onChargeToRoom={() => { setChargeToRoom(true); setSelectedPayment(''); }}
            activeBookings={activeBookings}
            selectedBooking={selectedBooking}
            onSelectBooking={setSelectedBooking}
            onConfirm={handleConfirmGroupPayment}
            busy={busy}
            onBack={() => { setSelectedGroup(null); setSelectedPayment(''); }}
            inStayBooking={selectedGroupInStay}
          />
        ) : selectedOrder ? (
          <BillOutPanel
            order={selectedOrder}
            paymentMethods={activePaymentMethods}
            selectedPayment={selectedPayment}
            onSelectPayment={(p) => { setSelectedPayment(p); setChargeToRoom(false); }}
            chargeToRoom={chargeToRoom}
            onChargeToRoom={() => { setChargeToRoom(true); setSelectedPayment(''); }}
            activeBookings={activeBookings}
            selectedBooking={selectedBooking}
            onSelectBooking={setSelectedBooking}
            onConfirm={handleConfirmPayment}
            busy={busy}
            onBack={() => setSelectedOrder(null)}
            onPreviewReceipt={() => setReceiptOrder(selectedOrder)}
            inStayBooking={selectedOrderInStay}
          />
        ) : (
          <DailySummary completed={completedOrders} />
        )}
      </div>
    </div>
  );
};

/** Tab Bill payment panel */
const TabBillPanel = ({
  tab, orders: tabOrders, paymentMethods, selectedPayment, onSelectPayment, onConfirm, busy, onBack,
}: {
  tab: any;
  orders: any[];
  paymentMethods: any[];
  selectedPayment: string;
  onSelectPayment: (p: string) => void;
  onConfirm: () => void;
  busy: boolean;
  onBack: () => void;
}) => {
  const allItems: any[] = tabOrders.flatMap((o: any) => (o.items as any[]) || []);
  const tabTotal = tabOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="w-8 h-8 md:hidden">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <p className="font-display text-base tracking-wider text-foreground">
              {tab.location_detail}
            </p>
          </div>
          <p className="font-body text-xs text-muted-foreground">
            {tab.guest_name || '—'} · Opened {tab.created_at ? format(new Date(tab.created_at), 'h:mm a') : '—'}
          </p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-body text-[10px]">
          Tab Bill
        </Badge>
      </div>

      {/* Itemized orders */}
      <div className="flex-1 md:overflow-y-auto px-4 py-3 space-y-4">
        <div className="space-y-1">
          {allItems.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between font-body text-sm">
              <span className="text-foreground">{item.qty || item.quantity || 1}× {item.name}</span>
              <span className="text-muted-foreground tabular-nums">₱{(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-3">
          <div className="flex justify-between font-display text-2xl text-gold pt-2">
            <span>Total</span>
            <span className="tabular-nums">₱{tabTotal.toLocaleString()}</span>
          </div>
          <p className="font-body text-xs text-muted-foreground mt-1">
            {tabOrders.length} order{tabOrders.length !== 1 ? 's' : ''} on this tab
          </p>
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <p className="font-display text-xs tracking-wider text-muted-foreground">SELECT PAYMENT METHOD</p>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectPayment(m.name)}
                className={`min-h-[52px] rounded-xl border-2 font-display text-sm tracking-wider transition-all ${
                  selectedPayment === m.name
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-card text-foreground hover:border-accent/40'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <Button
          onClick={onConfirm}
          disabled={!selectedPayment || busy}
          size="lg"
          className="w-full min-h-[56px] font-display text-base tracking-wider gap-2 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          {busy ? 'Processing…' : (
            <>
              <Check className="w-5 h-5" />
              Settle Tab — ₱{tabTotal.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

/** Clean, minimal order row */
const OrderRow = ({ order, selected, onSelect }: {
  order: any;
  selected: boolean;
  onSelect: () => void;
}) => {
  const elapsed = formatDistanceToNow(new Date(order.created_at), { addSuffix: false });
  const isPaid = order.status === 'Paid';
  const isReady = order.status === 'Ready';
  const isRoomCharge = order.payment_type === 'Charge to Room';

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border border-border/60 p-3 transition-all cursor-pointer active:scale-[0.98] overflow-hidden min-w-0 ${
        isPaid ? 'opacity-70 hover:opacity-90' : 'hover:bg-secondary/30'
      } ${selected ? 'ring-2 ring-gold bg-gold/5' : 'bg-card/90'}`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm text-foreground tracking-wider truncate">
            {order.guest_name || order.location_detail || order.order_type}
          </p>
          {order.guest_name && order.location_detail && (
            <p className="font-body text-xs text-muted-foreground truncate">{order.location_detail}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0 ml-2">
          {isPaid && <Printer className="w-3 h-3 text-gold" />}
          <Clock className="w-3 h-3" />
          <span className="font-body text-[11px] tabular-nums">{elapsed}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`font-body text-[10px] h-5 ${
          isRoomCharge && isPaid ? 'border-blue-400/50 text-blue-400' :
          isPaid ? 'border-emerald-400/50 text-emerald-400' :
          isReady ? 'border-cyan-400/50 text-cyan-400' :
          'border-amber-400/50 text-amber-400'
        }`}>
          {isRoomCharge && isPaid ? 'Room Charge' : isPaid ? 'Paid' : isReady ? 'Ready — Awaiting Serve' : 'Pending Payment'}
        </Badge>
        <span className="font-display text-sm text-gold tabular-nums">₱{order.total.toLocaleString()}</span>
      </div>
    </div>
  );
};

/** Bill Out / Payment panel */
const BillOutPanel = ({
  order, paymentMethods, selectedPayment, onSelectPayment,
  chargeToRoom, onChargeToRoom, activeBookings, selectedBooking,
  onSelectBooking, onConfirm, busy, onBack, onPreviewReceipt, inStayBooking
}: {
  order: any;
  paymentMethods: any[];
  selectedPayment: string;
  onSelectPayment: (p: string) => void;
  chargeToRoom: boolean;
  onChargeToRoom: () => void;
  activeBookings: any[];
  selectedBooking: string | null;
  onSelectBooking: (id: string | null) => void;
  onConfirm: () => void;
  busy: boolean;
  onBack: () => void;
  onPreviewReceipt: () => void;
  inStayBooking: any | null;
}) => {
  const items = (order.items as any[]) || [];
  const subtotal = items.reduce((s: number, i: any) => s + i.price * (i.qty || i.quantity || 1), 0);
  const sc = Number(order.service_charge || 0);
  const total = subtotal + sc;

  const isInStay = !!inStayBooking;
  const canConfirm = chargeToRoom ? !!selectedBooking : !!selectedPayment;

  const handleRoomFolioClick = () => {
    onChargeToRoom();
    onSelectBooking(inStayBooking?.id ?? null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="w-8 h-8 md:hidden">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <p className="font-display text-base tracking-wider text-foreground">
            {order.location_detail || order.order_type}
          </p>
          {order.guest_name && (
            <p className="font-body text-xs text-muted-foreground">{order.guest_name}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onPreviewReceipt} className="gap-1.5 font-display text-xs tracking-wider">
          <Printer className="w-3.5 h-3.5" /> Preview
        </Button>
        {isInStay && (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-body text-[10px]">
            <BedDouble className="w-3 h-3 mr-1" /> In-Stay
          </Badge>
        )}
      </div>

      {/* Itemized bill */}
      <div className="flex-1 md:overflow-y-auto px-4 py-3 space-y-4">
        <div className="space-y-1">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between font-body text-sm">
              <span className="text-foreground">{item.qty || item.quantity || 1}× {item.name}</span>
              <span className="text-muted-foreground tabular-nums">₱{(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1">
          <div className="flex justify-between font-body text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">₱{subtotal.toLocaleString()}</span>
          </div>
          {sc > 0 && (
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="tabular-nums">₱{sc.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-2xl text-gold pt-2">
            <span>Total</span>
            <span className="tabular-nums">₱{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-3">
          {/* In-stay guest: Charge to Room as primary */}
          {isInStay && (
            <>
              {!chargeToRoom ? (
                <button
                  onClick={handleRoomFolioClick}
                  className="w-full min-h-[56px] rounded-xl border-2 border-blue-400 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-display text-sm tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <BedDouble className="w-5 h-5" />
                  Charge to Room — {inStayBooking.resort_ops_units?.name || 'Room'}
                </button>
              ) : (
                <div className="rounded-xl border-2 border-gold bg-gold/10 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-gold" />
                    <span className="font-display text-sm tracking-wider text-gold">Charging to {inStayBooking.resort_ops_units?.name || 'Room'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{inStayBooking.resort_ops_guests?.full_name || 'Guest'}</p>
                  <button
                    onClick={() => { onSelectPayment(''); }}
                    className="text-xs text-muted-foreground underline mt-1"
                  >
                    Cancel — pay now instead
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 my-2">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground font-display tracking-wider">OR PAY NOW</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <p className="font-display text-xs tracking-wider text-muted-foreground">
            {isInStay ? 'PAY NOW' : 'SELECT PAYMENT METHOD'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectPayment(m.name)}
                className={`min-h-[52px] rounded-xl border-2 font-display text-sm tracking-wider transition-all ${
                  selectedPayment === m.name && !chargeToRoom
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-card text-foreground hover:border-accent/40'
                }`}
              >
                {m.name}
              </button>
            ))}
            {isInStay && (
              <button
                onClick={handleRoomFolioClick}
                className={`min-h-[52px] rounded-xl border-2 font-display text-sm tracking-wider transition-all flex items-center justify-center gap-2 ${
                  chargeToRoom
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-card text-foreground hover:border-accent/40'
                }`}
              >
                <BedDouble className="w-4 h-4" />
                Room Folio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || busy}
          size="lg"
          className="w-full min-h-[56px] font-display text-base tracking-wider gap-2 bg-gold text-primary-foreground hover:bg-gold/90"
        >
          {busy ? 'Processing…' : (
            <>
              <Check className="w-5 h-5" />
              Confirm Payment — ₱{total.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

/** Daily cash reconciliation summary */
const DailySummary = ({ completed }: { completed: any[] }) => {
  const summary = useMemo(() => {
    const methods: Record<string, { count: number; total: number }> = {};
    let totalRevenue = 0;
    let registerRevenue = 0;
    let roomChargeTotal = 0;
    let roomChargeCount = 0;

    completed.forEach(o => {
      const method = o.payment_type || 'Pending';
      const amount = Number(o.total) || 0;
      if (!methods[method]) methods[method] = { count: 0, total: 0 };
      methods[method].count += 1;
      methods[method].total += amount;
      totalRevenue += amount;
      if (method === 'Charge to Room') {
        roomChargeTotal += amount;
        roomChargeCount += 1;
      } else {
        registerRevenue += amount;
      }
    });

    return { methods, totalRevenue, registerRevenue, roomChargeTotal, roomChargeCount, orderCount: completed.length };
  }, [completed]);

  const sortedMethods = useMemo(() => {
    return Object.entries(summary.methods).sort((a, b) => b[1].total - a[1].total);
  }, [summary.methods]);

  const cashEntry = summary.methods['Cash'];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="font-display text-xs tracking-wider text-muted-foreground">
          DAILY SUMMARY — {format(new Date(), 'MMM d, yyyy')}
        </p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        <div className="text-center space-y-1">
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Register Revenue Today</p>
          <p className="font-display text-3xl text-gold tabular-nums">₱{summary.registerRevenue.toLocaleString()}</p>
          <p className="font-body text-xs text-muted-foreground">{summary.orderCount - summary.roomChargeCount} settled order{(summary.orderCount - summary.roomChargeCount) !== 1 ? 's' : ''}</p>
        </div>

        {summary.roomChargeCount > 0 && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 space-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-400" />
                <span className="font-display text-xs tracking-wider text-blue-400">ROOM CHARGES</span>
              </div>
              <span className="font-body text-xs text-blue-400">{summary.roomChargeCount} order{summary.roomChargeCount !== 1 ? 's' : ''}</span>
            </div>
            <p className="font-display text-lg text-blue-400 tabular-nums">₱{summary.roomChargeTotal.toLocaleString()}</p>
            <p className="font-body text-[10px] text-muted-foreground">Charged to guest rooms — settled at checkout</p>
          </div>
        )}

        {cashEntry && (
          <div className="rounded-xl border-2 border-gold/40 bg-gold/5 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gold" />
                <span className="font-display text-sm tracking-wider text-gold">CASH</span>
              </div>
              <Badge className="bg-gold/20 text-gold border-gold/30 font-body text-xs">{cashEntry.count} orders</Badge>
            </div>
            <p className="font-display text-2xl text-gold tabular-nums">₱{cashEntry.total.toLocaleString()}</p>
            <p className="font-body text-[11px] text-muted-foreground">Amount to reconcile with cash drawer</p>
          </div>
        )}

        {sortedMethods.length > 0 && (
          <div className="space-y-2">
            <p className="font-display text-xs tracking-wider text-muted-foreground">BREAKDOWN BY METHOD</p>
            <div className="space-y-1">
              {sortedMethods.filter(([m]) => m !== 'Charge to Room').map(([method, data]) => (
                <div key={method} className={`flex items-center justify-between rounded-lg px-3 py-2 ${method === 'Cash' ? 'bg-gold/5' : 'bg-secondary/50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-body text-sm ${method === 'Cash' ? 'text-gold font-semibold' : 'text-foreground'}`}>{method}</span>
                    <span className="font-body text-xs text-muted-foreground">({data.count})</span>
                  </div>
                  <span className={`font-display text-sm tabular-nums ${method === 'Cash' ? 'text-gold' : 'text-foreground'}`}>₱{data.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cashEntry && cashEntry.count > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3 hover:bg-secondary transition-colors">
              <span className="font-display text-xs tracking-wider text-muted-foreground">CASH TRANSACTIONS ({cashEntry.count})</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1">
              {completed.filter(o => o.payment_type === 'Cash').map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-card/80 border border-border/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-body text-xs text-foreground truncate">{o.location_detail || o.order_type}</p>
                    <p className="font-body text-[10px] text-muted-foreground">{o.closed_at ? format(new Date(o.closed_at), 'h:mm a') : '—'}</p>
                  </div>
                  <span className="font-display text-sm text-gold tabular-nums">₱{Number(o.total).toLocaleString()}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {summary.orderCount === 0 && (
          <p className="font-body text-sm text-muted-foreground text-center py-8">No paid orders yet today</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border text-center">
        <p className="font-body text-[10px] text-muted-foreground">Tap an order to settle · Tap completed to reprint</p>
      </div>
    </div>
  );
};

/** Grouped order card for the left panel */
const GroupedOrderRow = ({
  groupOrders,
  selected,
  onSelect,
  activeBookings,
}: {
  groupOrders: any[];
  selected: boolean;
  onSelect: () => void;
  activeBookings: any[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const isMulti = groupOrders.length > 1;
  const firstOrder = groupOrders[0];
  const total = groupOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const isPaid = groupOrders.every(o => o.status === 'Paid');
  const isReady = !isMulti && firstOrder.status === 'Ready';
  const isRoomCharge = !isMulti && firstOrder.payment_type === 'Charge to Room';
  const elapsed = formatDistanceToNow(new Date(firstOrder.created_at), { addSuffix: false });

  // Determine display label and sublabel
  let label = firstOrder.guest_name || firstOrder.location_detail || firstOrder.order_type;
  let sublabel: string | undefined = firstOrder.guest_name && firstOrder.location_detail
    ? firstOrder.location_detail
    : undefined;

  if (firstOrder.room_id) {
    const booking = activeBookings.find((b: any) => b.unit_id === firstOrder.room_id);
    if (booking) {
      label = booking.resort_ops_guests?.full_name || firstOrder.guest_name || label;
      sublabel = booking.resort_ops_units?.name || firstOrder.room_id;
    }
  }

  return (
    <div className={`rounded-xl border border-border/60 transition-all overflow-hidden min-w-0 ${
      isPaid ? 'opacity-70' : ''
    } ${selected ? 'ring-2 ring-gold bg-gold/5' : 'bg-card/90'}`}>
      <div
        onClick={onSelect}
        className="p-3 cursor-pointer active:scale-[0.98] hover:bg-secondary/30"
      >
        <div className="flex items-start justify-between mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm text-foreground tracking-wider truncate">{label}</p>
            {sublabel && <p className="font-body text-xs text-muted-foreground truncate">{sublabel}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isMulti && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                className="text-muted-foreground hover:text-foreground"
                aria-label={expanded ? 'Collapse orders' : 'Expand orders'}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            {isPaid && !isMulti && <Printer className="w-3 h-3 text-gold" />}
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="font-body text-[11px] tabular-nums text-muted-foreground">{elapsed}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {isMulti ? (
            <Badge variant="outline" className="font-body text-[10px] h-5 border-amber-400/50 text-amber-400">
              {groupOrders.length} orders
            </Badge>
          ) : (
            <Badge variant="outline" className={`font-body text-[10px] h-5 ${
              isRoomCharge && isPaid ? 'border-blue-400/50 text-blue-400' :
              isPaid ? 'border-emerald-400/50 text-emerald-400' :
              isReady ? 'border-cyan-400/50 text-cyan-400' :
              'border-amber-400/50 text-amber-400'
            }`}>
              {isRoomCharge && isPaid ? 'Room Charge' : isPaid ? 'Paid' : isReady ? 'Ready — Awaiting Serve' : 'Pending Payment'}
            </Badge>
          )}
          <span className="font-display text-sm text-gold tabular-nums">₱{total.toLocaleString()}</span>
        </div>
      </div>

      {isMulti && expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-1 bg-secondary/20">
          {groupOrders.map(order => {
            const orderItems = (order.items as any[]) || [];
            return (
              <div key={order.id} className="text-xs font-body text-muted-foreground">
                <span className="text-foreground">{format(new Date(order.created_at), 'h:mm a')}</span>
                {' · '}
                {orderItems.map((i: any) => `${i.qty || i.quantity || 1}× ${i.name}`).join(', ') || 'No items'}
                <span className="text-gold ml-1.5">₱{Number(order.total).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Payment panel for a grouped set of orders */
const GroupedBillOutPanel = ({
  groupOrders,
  paymentMethods,
  selectedPayment,
  onSelectPayment,
  chargeToRoom,
  onChargeToRoom,
  activeBookings,
  selectedBooking,
  onSelectBooking,
  onConfirm,
  busy,
  onBack,
  inStayBooking,
}: {
  groupOrders: any[];
  paymentMethods: any[];
  selectedPayment: string;
  onSelectPayment: (p: string) => void;
  chargeToRoom: boolean;
  onChargeToRoom: () => void;
  activeBookings: any[];
  selectedBooking: string | null;
  onSelectBooking: (id: string | null) => void;
  onConfirm: () => void;
  busy: boolean;
  onBack: () => void;
  inStayBooking: any | null;
}) => {
  const firstOrder = groupOrders[0];
  const total = groupOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const sc = groupOrders.reduce((s, o) => s + Number(o.service_charge || 0), 0);
  const subtotal = groupOrders.reduce((s, o) => {
    const items = (o.items as any[]) || [];
    return s + items.reduce((ss: number, i: any) => ss + i.price * (i.qty || i.quantity || 1), 0);
  }, 0);

  const isInStay = !!inStayBooking;
  const canConfirm = chargeToRoom ? !!selectedBooking : !!selectedPayment;

  const handleRoomFolioClick = () => {
    onChargeToRoom();
    onSelectBooking(inStayBooking?.id ?? null);
  };

  // Display label: use unit name if room group, otherwise location
  let label = firstOrder.location_detail || firstOrder.guest_name || firstOrder.order_type;
  if (firstOrder.room_id && inStayBooking) {
    label = inStayBooking.resort_ops_units?.name || label;
  }
  const guestName = inStayBooking?.resort_ops_guests?.full_name || firstOrder.guest_name;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="w-8 h-8 md:hidden">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <p className="font-display text-base tracking-wider text-foreground">{label}</p>
          {guestName && <p className="font-body text-xs text-muted-foreground">{guestName}</p>}
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-body text-[10px]">
          {groupOrders.length} orders
        </Badge>
        {isInStay && (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-body text-[10px]">
            <BedDouble className="w-3 h-3 mr-1" /> In-Stay
          </Badge>
        )}
      </div>

      {/* Itemized orders */}
      <div className="flex-1 md:overflow-y-auto px-4 py-3 space-y-4">
        {groupOrders.map((order, idx) => {
          const items = (order.items as any[]) || [];
          return (
            <div key={order.id}>
              <p className="font-display text-xs tracking-wider text-muted-foreground mb-1">
                Order {idx + 1} · {format(new Date(order.created_at), 'h:mm a')}
              </p>
              <div className="space-y-1">
                {items.map((item: any, iIdx: number) => (
                  <div key={iIdx} className="flex justify-between font-body text-sm">
                    <span className="text-foreground">{item.qty || item.quantity || 1}× {item.name}</span>
                    <span className="text-muted-foreground tabular-nums">₱{(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-1">
                <span className="font-body text-xs text-muted-foreground">₱{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div className="border-t border-border/50 pt-3 space-y-1">
          <div className="flex justify-between font-body text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">₱{subtotal.toLocaleString()}</span>
          </div>
          {sc > 0 && (
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="tabular-nums">₱{sc.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-2xl text-gold pt-2">
            <span>Total</span>
            <span className="tabular-nums">₱{total.toLocaleString()}</span>
          </div>
          <p className="font-body text-xs text-muted-foreground">
            {groupOrders.length} orders combined
          </p>
        </div>

        {/* Payment method selection */}
        <div className="space-y-3">
          {isInStay && (
            <>
              {!chargeToRoom ? (
                <button
                  onClick={handleRoomFolioClick}
                  className="w-full min-h-[56px] rounded-xl border-2 border-blue-400 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-display text-sm tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <BedDouble className="w-5 h-5" />
                  Charge to Room — {inStayBooking.resort_ops_units?.name || 'Room'}
                </button>
              ) : (
                <div className="rounded-xl border-2 border-gold bg-gold/10 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-gold" />
                    <span className="font-display text-sm tracking-wider text-gold">Charging to {inStayBooking.resort_ops_units?.name || 'Room'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{inStayBooking.resort_ops_guests?.full_name || 'Guest'}</p>
                  <button
                    onClick={() => { onSelectPayment(''); }}
                    className="text-xs text-muted-foreground underline mt-1"
                  >
                    Cancel — pay now instead
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 my-2">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground font-display tracking-wider">OR PAY NOW</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <p className="font-display text-xs tracking-wider text-muted-foreground">
            {isInStay ? 'PAY NOW' : 'SELECT PAYMENT METHOD'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectPayment(m.name)}
                className={`min-h-[52px] rounded-xl border-2 font-display text-sm tracking-wider transition-all ${
                  selectedPayment === m.name && !chargeToRoom
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-card text-foreground hover:border-accent/40'
                }`}
              >
                {m.name}
              </button>
            ))}
            {isInStay && (
              <button
                onClick={handleRoomFolioClick}
                className={`min-h-[52px] rounded-xl border-2 font-display text-sm tracking-wider transition-all flex items-center justify-center gap-2 ${
                  chargeToRoom
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-card text-foreground hover:border-accent/40'
                }`}
              >
                <BedDouble className="w-4 h-4" />
                Room Folio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || busy}
          size="lg"
          className="w-full min-h-[56px] font-display text-base tracking-wider gap-2 bg-gold text-primary-foreground hover:bg-gold/90"
        >
          {busy ? 'Processing…' : (
            <>
              <Check className="w-5 h-5" />
              Confirm Payment — ₱{total.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CashierBoard;
