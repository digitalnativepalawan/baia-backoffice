import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { format } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

interface TabInvoiceProps {
  tabId: string;
  onClose: () => void;
}

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

const TYPE_LABELS: Record<string, string> = {
  Room: 'Room Delivery',
  DineIn: 'Dine In',
  Beach: 'Beach Delivery',
  WalkIn: 'Walk-In Guest',
};

const TabInvoice = ({ tabId, onClose }: TabInvoiceProps) => {
  const qc = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [closing, setClosing] = useState(false);

  const { data: tab } = useQuery({
    queryKey: ['tab', tabId],
    queryFn: async () => {
      const { data } = await supabase.from('tabs').select('*').eq('id', tabId).single();
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['tab-orders', tabId],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  if (!tab) return null;

  const subtotal = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalServiceCharge = orders.reduce((s, o) => s + Number(o.service_charge || 0), 0);
  const grandTotal = subtotal + totalServiceCharge;

  const handleCloseTab = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    setClosing(true);
    try {
      // Close the tab
      await supabase.from('tabs').update({
        status: 'Closed',
        payment_method: paymentMethod,
        closed_at: new Date().toISOString(),
      }).eq('id', tabId);

      // Close all orders on this tab
      const orderIds = orders.map(o => o.id);
      if (orderIds.length > 0) {
        await supabase.from('orders').update({
          status: 'Closed',
          closed_at: new Date().toISOString(),
        }).in('id', orderIds);
      }

      qc.invalidateQueries({ queryKey: ['tabs-admin'] });
      qc.invalidateQueries({ queryKey: ['orders-admin'] });
      toast.success('Tab closed and settled');
      onClose();
    } catch {
      toast.error('Failed to close tab');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onClose} className="flex items-center gap-2 text-cream-dim hover:text-foreground font-body text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Tabs
      </button>

      {/* Invoice header */}
      <div className="text-center py-3 border border-border rounded-lg bg-secondary/30">
        <p className="font-display text-xs tracking-[0.3em] text-cream-dim uppercase">Baia Palawan</p>
        <p className="font-display text-lg text-foreground tracking-wider mt-1">Tab Invoice</p>
        <div className="flex justify-center gap-2 mt-2">
          <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-cream-dim">
            {TYPE_LABELS[tab.location_type] || tab.location_type}
          </span>
          <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-cream-dim">
            {tab.location_detail}
          </span>
        </div>
        {tab.guest_name && (
          <p className="font-body text-sm text-foreground mt-1">{tab.guest_name}</p>
        )}
        <p className="font-body text-[10px] text-cream-dim mt-1">
          Opened: {format(new Date(tab.created_at), 'MMM d, yyyy h:mm a')}
        </p>
        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${
          tab.status === 'Open' ? 'bg-green-900/50 text-green-300' : 'bg-muted text-cream-dim'
        }`}>
          {tab.status}
        </span>
      </div>

      {/* Orders grouped */}
      {orders.map((order, idx) => {
        const items = (Array.isArray(order.items) ? order.items : []) as unknown as OrderItem[];
        return (
          <div key={order.id} className="border border-border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-display text-xs text-cream-dim tracking-wider">
                Order #{idx + 1}
              </span>
              <span className="font-body text-[10px] text-cream-dim">
                {format(new Date(order.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex justify-between font-body text-sm py-0.5">
                <span className="text-foreground">{item.qty}x {item.name}</span>
                <span className="text-foreground">₱{(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between font-body text-xs text-cream-dim mt-1 pt-1 border-t border-border/50">
              <span>Subtotal: ₱{Number(order.total).toLocaleString()}</span>
              <span>SC: ₱{Number(order.service_charge || 0).toLocaleString()}</span>
            </div>
          </div>
        );
      })}

      {/* Grand totals */}
      <div className="border border-border rounded-lg p-3 bg-secondary/30">
        <div className="flex justify-between font-body text-sm mb-1">
          <span className="text-cream-dim">Total Food & Drinks</span>
          <span className="text-foreground">₱{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-body text-sm mb-2">
          <span className="text-cream-dim">Total Service Charge (10%)</span>
          <span className="text-foreground">₱{totalServiceCharge.toLocaleString()}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-display text-xl tracking-wider mt-2">
          <span className="text-foreground">Grand Total</span>
          <span className="text-foreground">₱{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Close tab (only if open) */}
      {tab.status === 'Open' && (
        <div className="space-y-3 pt-2">
          <Select onValueChange={setPaymentMethod} value={paymentMethod}>
            <SelectTrigger className="bg-secondary border-border text-foreground font-body">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="Cash" className="text-foreground font-body">Cash</SelectItem>
              <SelectItem value="Card" className="text-foreground font-body">Card</SelectItem>
              <SelectItem value="Charge to Room" className="text-foreground font-body">Charge to Room</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCloseTab} disabled={closing} className="font-display tracking-wider w-full py-5" variant="default">
            <X className="w-4 h-4 mr-2" />
            {closing ? 'Closing...' : 'Close Tab & Settle'}
          </Button>
        </div>
      )}

      {tab.status === 'Closed' && tab.payment_method && (
        <div className="text-center py-2">
          <p className="font-body text-sm text-cream-dim">
            Settled via <span className="text-foreground font-display">{tab.payment_method}</span>
          </p>
          {tab.closed_at && (
            <p className="font-body text-[10px] text-cream-dim">
              {format(new Date(tab.closed_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TabInvoice;
