import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { RoomTransaction } from '@/hooks/useRoomTransactions';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  unitName: string;
  guestName: string | null;
  bookingId: string | null;
  booking: any;
  transactions: RoomTransaction[];
  roomTypeId: string | null;
}

const CheckoutModal = ({ open, onOpenChange, unitId, unitName, guestName, bookingId, booking, transactions, roomTypeId }: CheckoutModalProps) => {
  const qc = useQueryClient();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const active = paymentMethods.filter(m => m.is_active && m.name !== 'Charge to Room');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overrideChecklist, setOverrideChecklist] = useState(false);

  // Fetch ALL orders for this room (paid and unpaid)
  const { data: allRoomOrders = [] } = useQuery({
    queryKey: ['checkout-all-room-orders', unitId],
    enabled: open && !!unitId,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, total, guest_name, status, payment_type, created_at, items')
        .eq('room_id', unitId)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  const unpaidOrders = allRoomOrders.filter((o: any) => ['New', 'Preparing', 'Ready', 'Served'].includes(o.status));
  const paidOrders = allRoomOrders.filter((o: any) => o.status === 'Paid');

  // Check for unserved orders (not yet "Served")
  const { data: unservedOrders = [] } = useQuery({
    queryKey: ['checkout-unserved-orders', unitId],
    enabled: open && !!unitId,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status')
        .eq('room_id', unitId)
        .in('status', ['New', 'Preparing', 'Ready']);
      return data || [];
    },
  });

  // Check incomplete tours
  const { data: incompleteTours = [] } = useQuery({
    queryKey: ['checkout-incomplete-tours', bookingId],
    enabled: open && !!bookingId,
    queryFn: async () => {
      const { data } = await (supabase.from('guest_tours') as any)
        .select('id, tour_name, status, price')
        .eq('booking_id', bookingId)
        .in('status', ['booked', 'confirmed']);
      return data || [];
    },
  });

  // Check incomplete requests
  const { data: incompleteRequests = [] } = useQuery({
    queryKey: ['checkout-incomplete-requests', bookingId],
    enabled: open && !!bookingId,
    queryFn: async () => {
      const { data } = await (supabase.from('guest_requests') as any)
        .select('id, request_type, status, price')
        .eq('booking_id', bookingId)
        .in('status', ['pending', 'confirmed']);
      return data || [];
    },
  });

  // Check housekeeping clearance for pre-checkout inspection
  const { data: hkOrder } = useQuery({
    queryKey: ['checkout-hk-clearance', unitName],
    enabled: open && !!unitName,
    queryFn: async () => {
      // Find the latest pre_checkout_inspection order for this unit
      const { data } = await (supabase.from('housekeeping_orders') as any)
        .select('id, status, damage_notes, inspection_by_name, task_type, inspection_status')
        .eq('unit_name', unitName)
        .eq('task_type', 'pre_checkout_inspection')
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Check guest bill agreement
  const { data: billAgreement } = useQuery({
    queryKey: ['checkout-bill-agreement', bookingId],
    enabled: open && !!bookingId,
    queryFn: async () => {
      const { data } = await supabase.from('resort_ops_bookings').select('bill_agreed_at').eq('id', bookingId!).maybeSingle();
      return data as any;
    },
  });


  const otaPlatforms = ['booking.com', 'airbnb', 'agoda', 'expedia', 'hostelworld', 'trip.com'];
  const isOtaStay = booking?.platform && otaPlatforms.includes(booking.platform.toLowerCase());
  const visibleTransactions = isOtaStay ? transactions.filter(t => t.transaction_type !== 'accommodation') : transactions;
  const charges = visibleTransactions.filter(t => t.total_amount > 0);
  const payments = visibleTransactions.filter(t => t.total_amount < 0);
  const totalCharges = charges.reduce((s, t) => s + t.total_amount, 0);
  const totalPayments = Math.abs(payments.reduce((s, t) => s + t.total_amount, 0));
  const paidFnbTotal = paidOrders.reduce((s, o: any) => s + (o.total || 0), 0);
  const unpaidTotal = unpaidOrders.reduce((s, o: any) => s + (o.total || 0), 0);
  // Include pending tours/requests in balance (completed ones are already on the ledger)
  const pendingToursTotal = incompleteTours.reduce((s: number, t: any) => s + Number(t.price || 0), 0);
  const pendingRequestsTotal = incompleteRequests.reduce((s: number, r: any) => s + Number(r.price || 0), 0);
  const balance = totalCharges - totalPayments + unpaidTotal + pendingToursTotal + pendingRequestsTotal;

  const nights = booking ? Math.max(1, Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000)) : 0;
  const roomRate = booking ? Number(booking.room_rate) : 0;

  // Checklist items
  const allOrdersServed = unservedOrders.length === 0;
  const allToursCompleted = incompleteTours.length === 0;
  const allRequestsCompleted = incompleteRequests.length === 0;
  const guestAgreed = !!billAgreement?.bill_agreed_at;
  const checklistPassed = allOrdersServed && allToursCompleted && allRequestsCompleted;

  // Phase detection: if inspection exists and is cleared, we do actual checkout
  const inspectionCleared = hkOrder?.inspection_status === 'cleared';

  // Phase 1: initiate pre-checkout inspection (lock unit + create HK task)
  const handleInitiateInspection = async () => {
    setSubmitting(true);
    try {
      // Lock the unit checkout
      await supabase.from('units').update({ checkout_locked: true } as any).eq('id', unitId);

      // Create the pre_checkout_inspection HK task
      await (supabase.from('housekeeping_orders') as any).insert({
        unit_name: unitName,
        room_type_id: roomTypeId || null,
        status: 'pre_inspection',
        task_type: 'pre_checkout_inspection',
        inspection_status: 'pending',
      });

      // Notify all clocked-in housekeeping staff via Telegram
      import('@/lib/telegram').then(({ notifyTelegram }) => {
        notifyTelegram('housekeeping,managers', `🔍 Pre-Checkout Inspection Needed\n${unitName} — ${guestName || 'Guest'}\nPlease accept and inspect before checkout.`);
      });

      await logAudit('updated', 'units', unitId, `Pre-checkout inspection initiated for ${guestName || 'Guest'} in ${unitName}`);

      qc.invalidateQueries({ queryKey: ['rooms-units'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-orders-all'] });
      qc.invalidateQueries({ queryKey: ['checkout-hk-clearance', unitName] });
      toast.success('Inspection task created — housekeepers notified');
      onOpenChange(false);
    } catch {
      toast.error('Failed to initiate inspection');
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 2: actual checkout (after inspection cleared)
  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const finalAmount = parseFloat(paymentAmount) || 0;
      if (finalAmount > 0 && paymentMethod) {
        await (supabase.from('room_transactions' as any) as any).insert({
          unit_id: unitId,
          unit_name: unitName,
          guest_name: guestName,
          booking_id: bookingId,
          transaction_type: 'payment',
          amount: -finalAmount,
          tax_amount: 0,
          service_charge_amount: 0,
          total_amount: -finalAmount,
          payment_method: paymentMethod,
          staff_name: localStorage.getItem('emp_name') || 'Staff',
          notes: 'Final checkout payment',
        });
      }

      // Batch-settle ALL unpaid room orders
      if (unpaidOrders.length > 0) {
        const orderIds = unpaidOrders.map((o: any) => o.id);
        await supabase.from('orders')
          .update({ status: 'Paid', closed_at: new Date().toISOString() })
          .in('id', orderIds);
      }

      if (bookingId) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('resort_ops_bookings').update({
          check_out: today,
          checked_out_at: new Date().toISOString(),
        } as any).eq('id', bookingId);
      }

      // Set unit to to_clean and unlock checkout
      await supabase.from('units').update({ status: 'to_clean', checkout_locked: false } as any).eq('id', unitId);

      // Telegram checkout notification
      import('@/lib/telegram').then(({ notifyTelegram }) => {
        notifyTelegram('reception,managers', `🚪 Check-out\n${guestName || 'Guest'} - ${unitName}`);
      });

      // Create a new clean_room housekeeping task (broadcast to all clocked-in housekeepers)
      await (supabase.from('housekeeping_orders' as any) as any).insert({
        unit_name: unitName,
        room_type_id: roomTypeId || null,
        status: 'pending_inspection',
        task_type: 'clean_room',
        inspection_status: 'pending',
      });

      // Notify housekeeping staff about the new clean_room task
      import('@/lib/telegram').then(({ notifyTelegram }) => {
        notifyTelegram('housekeeping,managers', `🧹 Room Ready for Cleaning\n${unitName} — guest has checked out.\nPlease accept and clean.`);
      });

      // Cancel any pending guest requests & tours for this booking
      if (bookingId) {
        await (supabase.from('guest_requests' as any) as any)
          .update({ status: 'cancelled' })
          .eq('booking_id', bookingId)
          .eq('status', 'pending');
        await (supabase.from('guest_tours' as any) as any)
          .update({ status: 'cancelled' })
          .eq('booking_id', bookingId)
          .eq('status', 'pending');
      }

      await logAudit('updated', 'units', unitId, `Checkout completed for ${guestName || 'Guest'} in ${unitName}`);

      qc.invalidateQueries({ queryKey: ['room-transactions', unitId] });
      qc.invalidateQueries({ queryKey: ['billing-room-orders'] });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
      qc.invalidateQueries({ queryKey: ['rooms-bookings'] });
      qc.invalidateQueries({ queryKey: ['rooms-units'] });
      qc.invalidateQueries({ queryKey: ['morning-briefing'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-orders'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-orders-all'] });
      qc.invalidateQueries({ queryKey: ['all-requests-experiences'] });
      qc.invalidateQueries({ queryKey: ['all-tours-experiences'] });
      qc.invalidateQueries({ queryKey: ['tour-bookings-experiences'] });
      qc.invalidateQueries({ queryKey: ['reception-guest-requests'] });
      qc.invalidateQueries({ queryKey: ['reception-tour-bookings'] });
      qc.invalidateQueries({ queryKey: ['reception-tours-today'] });
      qc.invalidateQueries({ queryKey: ['occupied-guests'] });
      toast.success('Checkout complete — housekeepers notified');
      onOpenChange(false);
    } catch {
      toast.error('Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            {inspectionCleared ? `Checkout — ${unitName}` : `Pre-Checkout Inspection — ${unitName}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* ── Phase 1: Initiate Inspection ── */}
          {!inspectionCleared && (
            <>
              {/* Pre-Checkout Checklist */}
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">Pre-Checkout Checklist</p>
                <ChecklistItem ok={allOrdersServed} label="All orders served & settled" detail={!allOrdersServed ? `${unservedOrders.length} order(s) not yet served` : undefined} />
                <ChecklistItem ok={allToursCompleted} label="Tours & experiences completed" detail={!allToursCompleted ? `${incompleteTours.length} tour(s) still active` : undefined} />
                <ChecklistItem ok={allRequestsCompleted} label="Guest requests completed" detail={!allRequestsCompleted ? `${incompleteRequests.length} request(s) still active` : undefined} />
                <ChecklistItem ok={guestAgreed} label="Guest reviewed & agreed to bill" detail={guestAgreed ? `Agreed ${new Date(billAgreement.bill_agreed_at).toLocaleString()}` : 'Not yet agreed on portal'} isWarning />

                {!checklistPassed && !overrideChecklist && (
                  <Button size="sm" variant="outline" onClick={() => setOverrideChecklist(true)}
                    className="font-display text-xs tracking-wider w-full mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Override & Continue
                  </Button>
                )}
              </div>

              {/* Housekeeping broadcast notice */}
              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
                <p className="font-display text-xs tracking-wider text-amber-400 uppercase">🧹 Housekeeping Inspection</p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  All clocked-in housekeepers will be notified and can accept the inspection task.
                </p>
              </div>

              {/* Inspection status (if already initiated) */}
              {hkOrder && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">Inspection Status</p>
                  <ChecklistItem
                    ok={hkOrder.inspection_status === 'cleared'}
                    label="Housekeeping pre-checkout inspection"
                    detail={
                      hkOrder.inspection_status === 'cleared'
                        ? `✅ Cleared by ${hkOrder.inspection_by_name || 'staff'}${hkOrder.damage_notes ? ` — Notes: ${hkOrder.damage_notes}` : ''}`
                        : '⏳ Waiting for housekeeper to inspect'
                    }
                    isWarning={hkOrder.inspection_status !== 'cleared'}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Phase 2: Actual Checkout (inspection cleared) ── */}
          {inspectionCleared && (
            <>
              {/* Inspection cleared badge */}
              <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3">
                <p className="font-display text-xs tracking-wider text-emerald-400 uppercase">✓ Inspection Cleared</p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  Cleared by {hkOrder?.inspection_by_name || 'staff'}
                  {hkOrder?.damage_notes ? ` — ${hkOrder.damage_notes}` : ''}
                </p>
              </div>

              {/* Unpaid F&B Orders */}
              {unpaidOrders.length > 0 && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
                  <p className="font-display text-xs tracking-wider text-amber-400 uppercase flex items-center gap-1">
                    🍽 {unpaidOrders.length} Unsettled Order{unpaidOrders.length > 1 ? 's' : ''} — ₱{unpaidTotal.toLocaleString()}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">These will be settled automatically at checkout.</p>
                  {unpaidOrders.map((o: any) => {
                    const items = Array.isArray(o.items) ? o.items : [];
                    return (
                      <div key={o.id} className="flex justify-between items-center bg-secondary/50 rounded p-2">
                        <div>
                          <p className="font-body text-xs text-foreground">
                            {items.map((i: any) => `${i.qty || 1}× ${i.name}`).join(', ') || 'F&B Order'}
                          </p>
                          <p className="font-body text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                        </div>
                        <span className="font-display text-xs text-foreground">₱{(o.total || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Guest info */}
              <div className="border border-border rounded-lg p-3 bg-secondary space-y-1">
                <p className="font-display text-sm text-foreground">{guestName || 'Guest'}</p>
                {booking && (
                  <p className="font-body text-xs text-muted-foreground">
                    {nights} night{nights !== 1 ? 's' : ''} · ₱{roomRate.toLocaleString()}/night
                    {charges.some(t => t.transaction_type === 'accommodation') && (
                      <span className="text-emerald-400 ml-1">✓ Posted to ledger</span>
                    )}
                  </p>
                )}
              </div>

              {/* Charges summary */}
              <div className="space-y-1.5">
                <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">Room Charges</p>
                {charges.map(t => (
                  <div key={t.id} className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground truncate flex-1">{t.notes || t.transaction_type}</span>
                    <span className="text-foreground">₱{t.total_amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-display text-sm">
                  <span className="text-foreground">Subtotal (Room)</span>
                  <span className="text-foreground">₱{totalCharges.toLocaleString()}</span>
                </div>
              </div>

              {/* Settled F&B Orders */}
              {paidOrders.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">
                    ✅ Settled F&B — ₱{paidFnbTotal.toLocaleString()}
                  </p>
                  {paidOrders.map((o: any) => {
                    const items = Array.isArray(o.items) ? o.items : [];
                    return (
                      <div key={o.id} className="flex justify-between items-center bg-secondary/50 rounded p-2">
                        <div>
                          <p className="font-body text-xs text-foreground">
                            {items.map((i: any) => `${i.qty || 1}× ${i.name}`).join(', ') || 'F&B Order'}
                          </p>
                          <p className="font-body text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                        </div>
                        <span className="font-display text-xs text-emerald-400">₱{(o.total || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {unpaidTotal > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between font-display text-sm">
                    <span className="text-amber-400">Unsettled F&B</span>
                    <span className="text-amber-400">₱{unpaidTotal.toLocaleString()}</span>
                  </div>
                </>
              )}

              {/* Payments received */}
              <div className="space-y-1.5">
                <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">Payments Received</p>
                {payments.map(t => (
                  <div key={t.id} className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground truncate flex-1">{t.payment_method} — {t.staff_name}</span>
                    <span className="text-emerald-400">₱{Math.abs(t.total_amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-display text-sm">
                  <span className="text-foreground">Total Paid</span>
                  <span className="text-emerald-400">₱{totalPayments.toLocaleString()}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-display text-lg tracking-wider">
                <span className="text-foreground">Remaining Balance</span>
                <span className={balance > 0 ? 'text-destructive' : 'text-emerald-400'}>
                  ₱{Math.abs(balance).toLocaleString()}
                </span>
              </div>

              {balance > 0 && (
                <div className="space-y-3 border border-border rounded-lg p-3">
                  <p className="font-display text-xs tracking-wider text-foreground uppercase">Final Payment</p>
                  <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                    <SelectTrigger className="bg-secondary border-border text-foreground font-body">
                      <SelectValue placeholder="Payment method" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {active.map(m => (
                        <SelectItem key={m.id} value={m.name} className="text-foreground font-body">{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    placeholder={`₱${balance.toLocaleString()}`}
                    className="bg-secondary border-border text-foreground font-body" />
                </div>
              )}

              {/* Housekeeping broadcast notice */}
              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
                <p className="font-display text-xs tracking-wider text-amber-400 uppercase">🧹 Housekeeping</p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  All clocked-in housekeepers will be notified and can accept the cleaning task.
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-display text-xs tracking-wider">Cancel</Button>
          {inspectionCleared ? (
            <Button
              onClick={handleCheckout}
              disabled={submitting}
              variant="destructive"
              className="font-display text-xs tracking-wider"
            >
              {submitting ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          ) : (
            <Button
              onClick={handleInitiateInspection}
              disabled={submitting || (!checklistPassed && !overrideChecklist)}
              className="font-display text-xs tracking-wider bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? 'Processing...' : hkOrder ? '⏳ Inspection Pending' : '🔍 Initiate Inspection'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Checklist row */
const ChecklistItem = ({ ok, label, detail, isWarning }: { ok: boolean; label: string; detail?: string; isWarning?: boolean }) => (
  <div className="flex items-start gap-2">
    {ok ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
    ) : isWarning ? (
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
    ) : (
      <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
    )}
    <div>
      <p className={`font-body text-xs ${ok ? 'text-foreground' : isWarning ? 'text-amber-400' : 'text-destructive'}`}>{label}</p>
      {detail && <p className="font-body text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  </div>
);

export default CheckoutModal;
