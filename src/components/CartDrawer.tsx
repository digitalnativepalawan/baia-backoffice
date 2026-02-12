import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/lib/cart';
import { formatWhatsAppMessage, buildWhatsAppUrl, OrderInfo } from '@/lib/order';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: string;
  orderType: string;
  locationDetail: string;
}

const TYPE_LABELS: Record<string, string> = {
  Room: 'Room Delivery',
  DineIn: 'Dine In',
  Beach: 'Beach Delivery',
  WalkIn: 'Walk-In Guest',
};

const CartDrawer = ({ open, onOpenChange, mode, orderType, locationDetail }: CartDrawerProps) => {
  const cart = useCart();
  const [paymentType, setPaymentType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).single();
      return data;
    },
  });

  const isStaff = mode === 'staff';
  const subtotal = cart.total();
  const serviceCharge = Math.round(subtotal * 0.10);
  const grandTotal = subtotal + serviceCharge;

  const handleSendToKitchen = async () => {
    if (isStaff && !paymentType) {
      toast.error('Please select a payment type');
      return;
    }
    if (!settings?.kitchen_whatsapp_number) {
      toast.error('Kitchen WhatsApp number not configured. Please contact admin.');
      return;
    }

    setSubmitting(true);
    try {
      // Find or create tab for this location
      const { data: existingTabs } = await supabase
        .from('tabs')
        .select('*')
        .eq('location_type', orderType)
        .eq('location_detail', locationDetail)
        .eq('status', 'Open')
        .limit(1);

      let tabId: string;

      if (existingTabs && existingTabs.length > 0) {
        tabId = existingTabs[0].id;
      } else {
        const { data: newTab, error: tabError } = await supabase
          .from('tabs')
          .insert({
            location_type: orderType,
            location_detail: locationDetail,
            status: 'Open',
          })
          .select('id')
          .single();

        if (tabError || !newTab) throw new Error('Failed to create tab');
        tabId = newTab.id;
      }

      // Save order with tab reference
      await supabase.from('orders').insert({
        order_type: orderType,
        location_detail: locationDetail,
        items: cart.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        total: subtotal,
        service_charge: serviceCharge,
        payment_type: isStaff ? paymentType : '',
        status: 'New',
        tab_id: tabId,
      });

      // WhatsApp notification
      const orderInfo: OrderInfo = {
        orderType: orderType as OrderInfo['orderType'],
        locationDetail,
        isStaff,
        paymentType: isStaff ? paymentType : undefined,
      };
      const message = formatWhatsAppMessage(orderInfo, cart.items, grandTotal);
      const url = buildWhatsAppUrl(settings.kitchen_whatsapp_number, message);

      cart.clearCart();
      onOpenChange(false);
      window.open(url, '_blank');
      toast.success('Order sent to kitchen!');
    } catch {
      toast.error('Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border max-h-[90vh]">
        {/* Invoice Header */}
        <DrawerHeader className="text-center pb-2">
          <p className="font-display text-xs tracking-[0.3em] text-cream-dim uppercase">Baia Palawan</p>
          <DrawerTitle className="font-display text-lg text-foreground tracking-wider">
            Order Invoice
          </DrawerTitle>
          <div className="flex justify-center gap-2 mt-1">
            <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-cream-dim">
              {TYPE_LABELS[orderType] || orderType}
            </span>
            <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-cream-dim">
              {locationDetail}
            </span>
          </div>
        </DrawerHeader>

        <div className="px-4 overflow-y-auto flex-1">
          {cart.items.length === 0 ? (
            <p className="font-body text-cream-dim text-center py-8">Your order is empty</p>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center text-cream-dim font-body text-[10px] uppercase tracking-wider pb-1 border-b border-border mb-2">
                <span className="flex-1">Item</span>
                <span className="w-8 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-20 text-right">Total</span>
                <span className="w-10" />
              </div>

              {/* Items */}
              <div className="flex flex-col gap-2">
                {cart.items.map(item => (
                  <div key={item.id} className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm text-foreground truncate">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-1 w-8 justify-center">
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} className="text-cream-dim hover:text-foreground">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-body text-xs text-foreground w-4 text-center">{item.quantity}</span>
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="text-cream-dim hover:text-foreground">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-body text-xs text-cream-dim w-16 text-right">
                      ₱{item.price.toLocaleString()}
                    </span>
                    <span className="font-display text-sm text-foreground w-20 text-right">
                      ₱{(item.price * item.quantity).toLocaleString()}
                    </span>
                    <button onClick={() => cart.removeItem(item.id)} className="text-cream-dim hover:text-destructive w-10 flex justify-end">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <Separator className="my-4" />
              <div className="space-y-1.5">
                <div className="flex justify-between font-body text-sm">
                  <span className="text-cream-dim">Subtotal</span>
                  <span className="text-foreground">₱{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-body text-sm">
                  <span className="text-cream-dim">Service Charge (10%)</span>
                  <span className="text-foreground">₱{serviceCharge.toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-display text-lg tracking-wider">
                  <span className="text-foreground">Grand Total</span>
                  <span className="text-foreground">₱{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Staff payment type */}
              {isStaff && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="font-display text-sm text-foreground tracking-wider mb-2">Payment Type</p>
                  <Select onValueChange={setPaymentType} value={paymentType}>
                    <SelectTrigger className="bg-secondary border-border text-foreground font-body">
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="Charge to Room" className="text-foreground font-body">Charge to Room</SelectItem>
                      <SelectItem value="Cash" className="text-foreground font-body">Cash</SelectItem>
                      <SelectItem value="Card" className="text-foreground font-body">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        {cart.items.length > 0 && (
          <DrawerFooter className="pt-2">
            <Button onClick={handleSendToKitchen} disabled={submitting} className="font-display tracking-wider py-6 w-full gap-2">
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send to Kitchen'}
            </Button>
            <p className="font-body text-[10px] text-cream-dim text-center mt-1">
              Order will be added to your open tab
            </p>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default CartDrawer;
