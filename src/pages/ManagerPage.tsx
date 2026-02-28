import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import OrderCard from '@/components/admin/OrderCard';
import ReportsDashboard from '@/components/admin/ReportsDashboard';
import PayrollDashboard from '@/components/admin/PayrollDashboard';
import InventoryDashboard from '@/components/admin/InventoryDashboard';
import ResortOpsDashboard from '@/components/admin/ResortOpsDashboard';
import RoomsDashboard from '@/components/admin/RoomsDashboard';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deductInventoryForOrder } from '@/lib/inventoryDeduction';
import { hasAccess, canEdit, canViewDocuments } from '@/lib/permissions';

const TAB_MAP: Record<string, { value: string; label: string }> = {
  orders: { value: 'orders', label: 'Orders' },
  reports: { value: 'reports', label: 'Reports' },
  inventory: { value: 'inventory', label: 'Inventory' },
  payroll: { value: 'payroll', label: 'HR' },
  resort_ops: { value: 'resort-ops', label: 'Resort Ops' },
  rooms: { value: 'rooms', label: 'Rooms' },
};

const SECTIONS = ['orders', 'reports', 'inventory', 'payroll', 'resort_ops', 'rooms'] as const;

const ManagerPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const empId = localStorage.getItem('emp_id');
  const empName = localStorage.getItem('emp_name') || 'Manager';

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['manager-permissions', empId],
    enabled: !!empId,
    queryFn: async () => {
      const { data } = await (supabase.from('employee_permissions' as any) as any)
        .select('permission').eq('employee_id', empId!);
      return ((data || []) as any[]).map((p: any) => p.permission as string);
    },
  });

  const isAdminUser = permissions.includes('admin');

  // Orders data for the orders tab
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-manager'],
    enabled: hasAccess(permissions, 'orders'),
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  // Realtime
  useEffect(() => {
    if (!hasAccess(permissions, 'orders')) return;
    const channel = supabase
      .channel('manager-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['orders-manager'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [permissions, qc]);

  const [activeStatus, setActiveStatus] = useState('New');
  const todayOrders = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return orders.filter(o => new Date(o.created_at) >= start);
  }, [orders]);

  const filteredOrders = todayOrders.filter(o => o.status === activeStatus);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { New: 0, Preparing: 0, Served: 0, Paid: 0 };
    todayOrders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [todayOrders]);

  const advanceOrder = async (orderId: string, nextStatus: string) => {
    const updateData: any = { status: nextStatus };
    if (nextStatus === 'Closed') updateData.closed_at = new Date().toISOString();
    await supabase.from('orders').update(updateData).eq('id', orderId);
    if (nextStatus === 'Preparing') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await deductInventoryForOrder(orderId, (order.items as any[]) || []);
        qc.invalidateQueries({ queryKey: ['ingredients'] });
      }
    }
    qc.invalidateQueries({ queryKey: ['orders-manager'] });
    toast.success(`Order → ${nextStatus}`);
  };

  if (!empId) {
    navigate('/employee-portal');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-texture flex items-center justify-center">
        <p className="font-body text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="min-h-screen bg-navy-texture flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="font-body text-sm text-muted-foreground">No dashboard access granted.</p>
          <Button onClick={() => navigate('/employee-portal')} variant="outline" className="font-display text-xs tracking-wider">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Portal
          </Button>
        </div>
      </div>
    );
  }

  // Build allowed tabs based on permissions
  const allowedTabs = isAdminUser
    ? Object.values(TAB_MAP)
    : SECTIONS.filter(s => hasAccess(permissions, s)).map(s => TAB_MAP[s]).filter(Boolean);
  const defaultTab = allowedTabs[0]?.value || 'orders';

  // Resolve readOnly per section
  const readOnly = (section: string) => !canEdit(permissions, section);
  const docsAllowed = canViewDocuments(permissions);

  return (
    <div className="min-h-screen bg-navy-texture overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/employee-portal')} className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg tracking-wider text-foreground">Dashboard</h1>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full bg-secondary mb-6 flex-wrap h-auto">
            {allowedTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="font-display text-xs tracking-wider flex-1 min-h-[44px]">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {hasAccess(permissions, 'orders') && (
            <TabsContent value="orders" className="space-y-4">
              <div className="flex gap-1 flex-wrap">
                {['New', 'Preparing', 'Served', 'Paid'].map(s => (
                  <Button key={s} size="sm" variant={activeStatus === s ? 'default' : 'outline'}
                    onClick={() => setActiveStatus(s)} className="font-display text-xs tracking-wider gap-1">
                    {s} <span className="text-muted-foreground">({statusCounts[s] || 0})</span>
                  </Button>
                ))}
              </div>
              {filteredOrders.length === 0 && (
                <p className="font-body text-sm text-muted-foreground text-center py-4">No {activeStatus.toLowerCase()} orders</p>
              )}
              {filteredOrders.map(order => (
                <OrderCard key={order.id} order={order} onAdvance={readOnly('orders') ? undefined : advanceOrder} />
              ))}
            </TabsContent>
          )}

          {hasAccess(permissions, 'reports') && (
            <TabsContent value="reports"><ReportsDashboard readOnly={readOnly('reports')} /></TabsContent>
          )}

          {hasAccess(permissions, 'inventory') && (
            <TabsContent value="inventory"><InventoryDashboard readOnly={readOnly('inventory')} /></TabsContent>
          )}

          {hasAccess(permissions, 'payroll') && (
            <TabsContent value="payroll"><PayrollDashboard readOnly={readOnly('payroll')} /></TabsContent>
          )}

          {hasAccess(permissions, 'resort_ops') && (
            <TabsContent value="resort-ops"><ResortOpsDashboard readOnly={readOnly('resort_ops')} /></TabsContent>
          )}

          {hasAccess(permissions, 'rooms') && (
            <TabsContent value="rooms"><RoomsDashboard readOnly={readOnly('rooms')} canViewDocuments={docsAllowed} /></TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default ManagerPage;
