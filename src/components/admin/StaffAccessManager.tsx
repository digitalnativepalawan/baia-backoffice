import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const GRANULAR_PERMISSIONS = [
  { key: 'orders', label: 'Orders' },
  { key: 'menu', label: 'Menu' },
  { key: 'reports', label: 'Reports' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'resort_ops', label: 'Resort Ops' },
  { key: 'rooms', label: 'Rooms' },
] as const;

const StaffAccessManager = () => {
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-access'],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('active', true).order('name');
      return data || [];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['employee-permissions'],
    queryFn: async () => {
      const { data } = await (supabase.from('employee_permissions' as any) as any).select('*');
      return (data || []) as { id: string; employee_id: string; permission: string }[];
    },
  });

  const hasPermission = (empId: string, perm: string) =>
    permissions.some(p => p.employee_id === empId && p.permission === perm);

  const isAdmin = (empId: string) => hasPermission(empId, 'admin');

  const togglePermission = async (empId: string, perm: string) => {
    const existing = permissions.find(p => p.employee_id === empId && p.permission === perm);
    if (existing) {
      await (supabase.from('employee_permissions' as any) as any).delete().eq('id', existing.id);
    } else {
      await (supabase.from('employee_permissions' as any) as any).insert({ employee_id: empId, permission: perm });
    }
    qc.invalidateQueries({ queryKey: ['employee-permissions'] });
    toast.success('Permission updated');
  };

  if (employees.length === 0) {
    return (
      <section>
        <h3 className="font-display text-sm tracking-wider text-foreground mb-4">Staff Access</h3>
        <p className="font-body text-xs text-muted-foreground">No active employees found.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="font-display text-sm tracking-wider text-foreground mb-2">Staff Access</h3>
      <p className="font-body text-xs text-muted-foreground mb-4">
        Toggle which dashboard tabs each employee can access via the Manager view.
      </p>
      <div className="space-y-4">
        {employees.map((emp: any) => {
          const empIsAdmin = isAdmin(emp.id);
          return (
          <div key={emp.id} className="border border-border rounded-lg p-3">
            <p className="font-display text-sm text-foreground tracking-wider mb-2">
              {emp.display_name || emp.name}
            </p>

            {/* Admin toggle — separated and distinct */}
            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <Switch
                checked={empIsAdmin}
                onCheckedChange={() => togglePermission(emp.id, 'admin')}
                className="data-[state=checked]:bg-amber-600"
              />
              <span className="font-display text-xs tracking-wider text-foreground">
                Admin (Full Access)
              </span>
            </label>
            {empIsAdmin && (
              <p className="font-body text-[11px] text-amber-500/80 mb-2 ml-[3.25rem]">
                Full access to all sections
              </p>
            )}

            {/* Granular permissions */}
            <div className={`grid grid-cols-2 gap-2 mt-2 ${empIsAdmin ? 'opacity-40 pointer-events-none' : ''}`}>
              {GRANULAR_PERMISSIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={empIsAdmin || hasPermission(emp.id, key)}
                    onCheckedChange={() => togglePermission(emp.id, key)}
                    disabled={empIsAdmin}
                  />
                  <span className="font-body text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
};

export default StaffAccessManager;
