import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { DollarSign, ShoppingCart, TrendingUp, Lock } from 'lucide-react';

type DateRange = 'today' | 'week' | 'month' | 'all';

const ReportsDashboard = () => {
  const [range, setRange] = useState<DateRange>('today');

  const dateFrom = useMemo(() => {
    const now = new Date();
    switch (range) {
      case 'today': return startOfDay(now).toISOString();
      case 'week': return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      case 'month': return startOfMonth(now).toISOString();
      default: return '2000-01-01T00:00:00Z';
    }
  }, [range]);

  const { data: closedOrders = [] } = useQuery({
    queryKey: ['reports-orders', dateFrom],
    queryFn: async () => {
      let q = supabase.from('orders').select('*').eq('status', 'Closed');
      if (range !== 'all') q = q.gte('closed_at', dateFrom);
      const { data } = await q.order('closed_at', { ascending: false });
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const revenue = closedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const count = closedOrders.length;
    const avg = count ? revenue / count : 0;

    // Revenue by type
    const byType: Record<string, number> = {};
    closedOrders.forEach(o => {
      byType[o.order_type] = (byType[o.order_type] || 0) + (o.total || 0);
    });

    // Top items
    const itemMap: Record<string, { qty: number; revenue: number }> = {};
    closedOrders.forEach(o => {
      ((o.items as any[]) || []).forEach((i: any) => {
        if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, revenue: 0 };
        itemMap[i.name].qty += i.qty || 1;
        itemMap[i.name].revenue += (i.price || 0) * (i.qty || 1);
      });
    });
    const topItems = Object.entries(itemMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);

    return { revenue, count, avg, byType, topItems };
  }, [closedOrders]);

  const ranges: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex gap-2">
        {ranges.map(r => (
          <Button
            key={r.key}
            size="sm"
            variant={range === r.key ? 'default' : 'outline'}
            onClick={() => setRange(r.key)}
            className="font-body text-xs flex-1"
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-gold mx-auto mb-1" />
            <p className="font-display text-lg text-foreground">₱{stats.revenue.toLocaleString()}</p>
            <p className="font-body text-xs text-cream-dim">Revenue</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="w-5 h-5 text-gold mx-auto mb-1" />
            <p className="font-display text-lg text-foreground">{stats.count}</p>
            <p className="font-body text-xs text-cream-dim">Orders</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-gold mx-auto mb-1" />
            <p className="font-display text-lg text-foreground">₱{stats.avg.toFixed(0)}</p>
            <p className="font-body text-xs text-cream-dim">Avg Order</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <section>
          <h3 className="font-display text-sm tracking-wider text-foreground mb-3">Revenue by Order Type</h3>
          <div className="space-y-2">
            {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, rev]) => (
              <div key={type} className="flex justify-between items-center p-2 border border-border rounded">
                <span className="font-body text-sm text-foreground">{type}</span>
                <span className="font-display text-sm text-gold">₱{rev.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Selling Items */}
      {stats.topItems.length > 0 && (
        <section>
          <h3 className="font-display text-sm tracking-wider text-foreground mb-3">Top Selling Items</h3>
          <div className="space-y-2">
            {stats.topItems.map(([name, data]) => (
              <div key={name} className="flex justify-between items-center p-2 border border-border rounded">
                <div>
                  <span className="font-body text-sm text-foreground">{name}</span>
                  <span className="font-body text-xs text-cream-dim ml-2">×{data.qty}</span>
                </div>
                <span className="font-display text-sm text-gold">₱{data.revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coming Soon */}
      <section className="p-4 border border-dashed border-border rounded-lg opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-cream-dim" />
          <h3 className="font-display text-sm tracking-wider text-foreground">Food Cost & Profit Analysis</h3>
        </div>
        <p className="font-body text-xs text-cream-dim">
          Coming soon — will use menu item food costs to calculate margins per item and overall profit.
        </p>
      </section>

      <section className="p-4 border border-dashed border-border rounded-lg opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-cream-dim" />
          <h3 className="font-display text-sm tracking-wider text-foreground">Tours Revenue</h3>
        </div>
        <p className="font-body text-xs text-cream-dim">
          Coming soon — track revenue from tours and activities.
        </p>
      </section>
    </div>
  );
};

export default ReportsDashboard;
