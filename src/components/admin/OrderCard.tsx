import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Truck, CreditCard, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_FLOW: Record<string, { next: string; label: string; icon: React.ReactNode }> = {
  New: { next: 'Preparing', label: 'Start Preparing', icon: <ChefHat className="w-4 h-4" /> },
  Preparing: { next: 'Served', label: 'Mark Served', icon: <Truck className="w-4 h-4" /> },
  Served: { next: 'Paid', label: 'Mark Paid', icon: <CreditCard className="w-4 h-4" /> },
  Paid: { next: 'Closed', label: 'Close Order', icon: <CheckCircle2 className="w-4 h-4" /> },
};

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-gold/20 text-gold border-gold/40',
  Preparing: 'bg-orange-500/20 text-orange-400 border-orange-400/40',
  Served: 'bg-blue-500/20 text-blue-400 border-blue-400/40',
  Paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40',
  Closed: 'bg-muted text-muted-foreground border-border',
};

interface OrderCardProps {
  order: any;
  onAdvance: (orderId: string, nextStatus: string) => void;
}

const OrderCard = ({ order, onAdvance }: OrderCardProps) => {
  const flow = STATUS_FLOW[order.status];
  const items = (order.items as any[]) || [];
  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.Closed;

  return (
    <div className={`p-4 border rounded-lg ${order.status === 'New' ? 'border-gold/50 bg-gold/5' : 'border-border bg-card/50'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-display text-sm text-foreground tracking-wider">
            {order.order_type} — {order.location_detail}
          </p>
          <p className="font-body text-xs text-cream-dim mt-0.5">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="outline" className={`font-body text-xs ${statusColor}`}>
          {order.status}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between font-body text-sm">
            <span className="text-foreground">{item.qty}× {item.name}</span>
            <span className="text-cream-dim">₱{(item.price * item.qty).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-border">
        <div>
          <span className="font-display text-sm text-gold">₱{order.total}</span>
          {order.payment_type && (
            <span className="font-body text-xs text-cream-dim ml-2">({order.payment_type})</span>
          )}
        </div>
        {flow && (
          <Button
            size="sm"
            onClick={() => onAdvance(order.id, flow.next)}
            className="font-body text-xs gap-1.5"
          >
            {flow.icon}
            {flow.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
