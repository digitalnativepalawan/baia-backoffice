import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Flame, GlassWater, Clock, Truck, Home, Receipt, Bell } from 'lucide-react';
import { useState } from 'react';

interface WaitstaffOrderCardProps {
  order: any;
  onAction?: (orderId: string, action: string) => Promise<void>;
  onOpenDetail?: (order: any) => void;
  compact?: boolean;
}

const WaitstaffOrderCard = ({ order, onAction, onOpenDetail, compact }: WaitstaffOrderCardProps) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busy = busyAction !== null;
  const items = (order.items as any[]) || [];
  const elapsed = formatDistanceToNow(new Date(order.created_at), { addSuffix: false });

  const foodItems = items.filter((i: any) => {
    const d = i.department || 'kitchen';
    return d === 'kitchen' || d === 'both';
  });
  const drinkItems = items.filter((i: any) => i.department === 'bar' || i.department === 'both');

  const hasFoodItems = foodItems.length > 0;
  const hasDrinkItems = drinkItems.length > 0;
  const hasFoodOnly = hasFoodItems && !hasDrinkItems;
  const hasDrinksOnly = hasDrinkItems && !hasFoodItems;
  const hasBoth = hasFoodItems && hasDrinkItems;

  const isReady = order.status === 'Ready';
  const isRoomCharge = order.payment_type === 'Charge to Room';
  const isTab = !!order.tab_id;

  // Border color: amber for food, purple for drinks, gold for mixed
  const borderClass = hasFoodOnly
    ? 'border-l-amber-400'
    : hasDrinksOnly
    ? 'border-l-purple-400'
    : 'border-l-gold';

  const handleAction = async (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    if (!onAction || busy) return;
    setBusyAction(action);
    try {
      await onAction(order.id, action);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      onClick={() => onOpenDetail?.(order)}
      className={`rounded-xl border border-border/60 border-l-4 ${borderClass} transition-all cursor-pointer active:scale-[0.98] bg-card/90 backdrop-blur-sm ${compact ? 'p-3' : 'p-4'} ${
        isReady ? 'ring-2 ring-emerald-400/60 shadow-[0_0_16px_-4px_hsl(142,70%,55%,0.4)]' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-foreground tracking-wider truncate">
            {order.location_detail || order.order_type}
          </p>
          {order.guest_name && (
            <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{order.guest_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {isReady && (
            <span className="flex items-center gap-1 font-body text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 animate-pulse">
              <Bell className="w-3 h-3" />
              READY
            </span>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="font-body text-[11px] tabular-nums">{elapsed}</span>
          </div>
        </div>
      </div>

      {/* Department type badges + status dots */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {foodItems.length > 0 && (
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                order.kitchen_status === 'ready'
                  ? 'bg-emerald-400'
                  : order.kitchen_status === 'preparing'
                  ? 'bg-orange-400'
                  : 'bg-muted-foreground'
              }`}
            />
            <Flame className="w-3 h-3 text-amber-400" />
            <span className="font-body text-[11px] text-muted-foreground">{foodItems.length}</span>
          </div>
        )}
        {drinkItems.length > 0 && (
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                order.bar_status === 'ready'
                  ? 'bg-emerald-400'
                  : order.bar_status === 'preparing'
                  ? 'bg-orange-400'
                  : 'bg-muted-foreground'
              }`}
            />
            <GlassWater className="w-3 h-3 text-purple-400" />
            <span className="font-body text-[11px] text-muted-foreground">{drinkItems.length}</span>
          </div>
        )}
        {isRoomCharge && (
          <Badge
            variant="outline"
            className="font-body text-[10px] h-5 gap-1 bg-[hsl(210,70%,50%,0.15)] text-[hsl(210,70%,65%)] border-[hsl(210,70%,50%,0.3)]"
          >
            <Home className="w-3 h-3" /> Room
          </Badge>
        )}
        {isTab && !isRoomCharge && (
          <Badge
            variant="outline"
            className="font-body text-[10px] h-5 gap-1 bg-[hsl(270,60%,55%,0.15)] text-[hsl(270,60%,70%)] border-[hsl(270,60%,55%,0.3)]"
          >
            <Receipt className="w-3 h-3" /> Tab
          </Badge>
        )}
        {hasBoth && (
          <Badge
            variant="outline"
            className="font-body text-[10px] h-5 bg-card text-muted-foreground border-border/60"
          >
            Mixed
          </Badge>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-0.5 mb-3">
        {items.slice(0, compact ? 3 : 6).map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between font-body">
            <span className="text-foreground text-sm truncate mr-2 flex items-center gap-1">
              {item.department === 'bar' ? (
                <GlassWater className="w-3 h-3 text-purple-400 flex-shrink-0" />
              ) : (
                <Flame className="w-3 h-3 text-amber-400 flex-shrink-0" />
              )}
              {item.qty}× {item.name}
            </span>
            <span className="text-muted-foreground text-sm tabular-nums flex-shrink-0">
              ₱{(item.price * item.qty).toLocaleString()}
            </span>
          </div>
        ))}
        {items.length > (compact ? 3 : 6) && (
          <p className="font-body text-[11px] text-muted-foreground">
            +{items.length - (compact ? 3 : 6)} more…
          </p>
        )}
      </div>

      {/* Total + Actions */}
      <div className="pt-2.5 border-t border-border/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-display text-lg text-gold tabular-nums flex-shrink-0">
            ₱{order.total.toLocaleString()}
          </span>
          {isReady && onAction && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {order.room_id && (
                <Button
                  onClick={(e) => handleAction(e, 'room-charge')}
                  disabled={busy}
                  size="sm"
                  className="font-display tracking-wider gap-1.5 text-xs min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {busyAction === 'room-charge' ? 'Updating…' : <><Home className="w-4 h-4" /> Room Charge</>}
                </Button>
              )}
              <Button
                onClick={(e) => handleAction(e, 'mark-served')}
                disabled={busy}
                size="sm"
                className="font-display tracking-wider gap-1.5 text-xs min-h-[44px] px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white"
              >
                {busyAction === 'mark-served' ? 'Updating…' : <><Truck className="w-4 h-4" /> Send to Cashier</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitstaffOrderCard;
