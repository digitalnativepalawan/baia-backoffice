import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ChefHat, Wine, Truck, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { canEdit } from '@/lib/permissions';

interface ServiceOrderDetailProps {
  order: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: string[];
  onAction: (orderId: string, action: string) => Promise<void>;
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-muted-foreground',
  preparing: 'bg-orange-400',
  ready: 'bg-emerald-400',
};

const ServiceOrderDetail = ({ order, open, onOpenChange, permissions, onAction }: ServiceOrderDetailProps) => {
  const [busy, setBusy] = useState<string | null>(null);

  if (!order) return null;

  const items = (order.items as any[]) || [];
  const foodItems = items.filter((i: any) => { const d = i.department || 'kitchen'; return d === 'kitchen' || d === 'both'; });
  const barItems = items.filter((i: any) => i.department === 'bar' || i.department === 'both');

  const handleAction = async (action: string) => {
    if (busy) return;
    setBusy(action);
    try { await onAction(order.id, action); } finally { setBusy(null); }
  };

  // Build all available actions based on permissions + order state
  const actions: { label: string; action: string; icon: React.ReactNode; variant: 'default' | 'outline'; dept: string }[] = [];

  if (canEdit(permissions, 'kitchen') && foodItems.length > 0) {
    if (order.kitchen_status === 'pending') {
      actions.push({ label: 'Start Preparing (Kitchen)', action: 'kitchen-start', icon: <ChefHat className="w-5 h-5" />, variant: 'default', dept: 'kitchen' });
    } else if (order.kitchen_status === 'preparing') {
      actions.push({ label: 'Mark Kitchen Ready', action: 'kitchen-ready', icon: <CheckCircle2 className="w-5 h-5" />, variant: 'default', dept: 'kitchen' });
    }
  }

  if (canEdit(permissions, 'bar') && barItems.length > 0) {
    if (order.bar_status === 'pending') {
      actions.push({ label: 'Start Mixing (Bar)', action: 'bar-start', icon: <Wine className="w-5 h-5" />, variant: 'default', dept: 'bar' });
    } else if (order.bar_status === 'preparing') {
      actions.push({ label: 'Mark Bar Ready', action: 'bar-ready', icon: <CheckCircle2 className="w-5 h-5" />, variant: 'default', dept: 'bar' });
    }
  }

  if (canEdit(permissions, 'reception')) {
    const allReady = (foodItems.length === 0 || order.kitchen_status === 'ready') && (barItems.length === 0 || order.bar_status === 'ready');
    if (allReady && order.status !== 'Served' && order.status !== 'Paid') {
      actions.push({ label: 'Mark Served', action: 'mark-served', icon: <Truck className="w-5 h-5" />, variant: 'default', dept: 'reception' });
    }
    if (order.status === 'Served') {
      actions.push({ label: 'Mark Paid', action: 'mark-paid', icon: <CreditCard className="w-5 h-5" />, variant: 'default', dept: 'reception' });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-display tracking-wider text-foreground flex items-center gap-2">
            {order.order_type === 'Room' ? `🏠 ${order.location_detail}` :
             order.order_type === 'DineIn' ? `🍽️ ${order.location_detail}` :
             `📋 ${order.location_detail || order.order_type}`}
          </DrawerTitle>
          {order.guest_name && (
            <p className="font-body text-sm text-muted-foreground">{order.guest_name}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(order.created_at), 'h:mm a')}
            </span>
            <Badge variant="outline" className="font-body text-xs">{order.status}</Badge>
            {order.tab_id && (
              <Badge variant="outline" className="font-body text-xs bg-purple-500/20 text-purple-400 border-purple-400/40">Tab</Badge>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Department statuses */}
          <div className="flex gap-3">
            {foodItems.length > 0 && (
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 flex-1">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[order.kitchen_status] || 'bg-muted-foreground'}`} />
                <span className="font-body text-sm">🍳 Kitchen: <span className="font-semibold capitalize">{order.kitchen_status}</span></span>
              </div>
            )}
            {barItems.length > 0 && (
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 flex-1">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[order.bar_status] || 'bg-muted-foreground'}`} />
                <span className="font-body text-sm">🍹 Bar: <span className="font-semibold capitalize">{order.bar_status}</span></span>
              </div>
            )}
          </div>

          <Separator />

          {/* All items with department badges */}
          <div className="space-y-2">
            <h4 className="font-display text-xs tracking-wider text-muted-foreground uppercase">Items</h4>
            {items.map((item: any, idx: number) => {
              const dept = item.department || 'kitchen';
              return (
                <div key={idx} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{dept === 'bar' ? '🍹' : '🍳'}</span>
                    <span className="font-body text-sm text-foreground">{item.qty}× {item.name}</span>
                  </div>
                  <span className="font-body text-sm text-muted-foreground">₱{(item.price * item.qty).toLocaleString()}</span>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="font-display text-sm tracking-wider text-muted-foreground">TOTAL</span>
            <span className="font-display text-xl text-gold">₱{order.total.toLocaleString()}</span>
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                {actions.map(a => (
                  <Button
                    key={a.action}
                    onClick={() => handleAction(a.action)}
                    disabled={busy !== null}
                    variant={a.variant}
                    size="lg"
                    className="w-full font-display tracking-wider gap-2 min-h-[52px]"
                  >
                    {busy === a.action ? 'Updating…' : <>{a.icon} {a.label}</>}
                  </Button>
                ))}
              </div>
            </>
          )}

          {actions.length === 0 && (
            <p className="font-body text-sm text-muted-foreground text-center py-2">
              No actions available with your permissions
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ServiceOrderDetail;
