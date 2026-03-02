import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle, Camera, Upload } from 'lucide-react';
import { toast } from 'sonner';

const from = (table: string) => supabase.from(table as any);

interface HousekeepingInspectionProps {
  order: any;
  onClose: () => void;
}

const HousekeepingInspection = ({ order, onClose }: HousekeepingInspectionProps) => {
  const qc = useQueryClient();
  const step = order.status === 'pending_inspection' || order.status === 'inspecting' ? 'inspection' : 'cleaning';

  // ── Checklist items for this room type ──
  const { data: checklistItems = [] } = useQuery({
    queryKey: ['housekeeping-checklist-items', order.room_type_id],
    enabled: !!order.room_type_id,
    queryFn: async () => {
      const { data } = await from('housekeeping_checklists')
        .select('*').eq('room_type_id', order.room_type_id).order('sort_order');
      return (data || []) as any[];
    },
  });

  // ── Cleaning packages + items for this room type ──
  const { data: packages = [] } = useQuery({
    queryKey: ['cleaning-packages-for-type', order.room_type_id],
    enabled: !!order.room_type_id,
    queryFn: async () => {
      const { data } = await from('cleaning_packages')
        .select('*').eq('room_type_id', order.room_type_id);
      return (data || []) as any[];
    },
  });

  const { data: packageItems = [] } = useQuery({
    queryKey: ['cleaning-package-items-all'],
    queryFn: async () => {
      const { data } = await from('cleaning_package_items').select('*');
      return (data || []) as any[];
    },
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const { data } = await supabase.from('ingredients').select('*').order('name');
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id, name, display_name').eq('active', true).order('name');
      return data || [];
    },
  });

  // ── Inspection state ──
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    () => {
      const existing = order.inspection_data as any[] || [];
      const map: Record<string, boolean> = {};
      existing.forEach((e: any) => { map[e.id] = e.checked; });
      return map;
    }
  );
  const [itemCounts, setItemCounts] = useState<Record<string, string>>(
    () => {
      const existing = order.inspection_data as any[] || [];
      const map: Record<string, string> = {};
      existing.forEach((e: any) => { if (e.count !== undefined) map[e.id] = String(e.count); });
      return map;
    }
  );
  const [damageNotes, setDamageNotes] = useState(order.damage_notes || '');
  const [assignedTo, setAssignedTo] = useState(order.assigned_to || '');
  const [inspecting, setInspecting] = useState(false);

  // ── Cleaning state ──
  const [selectedPackageId, setSelectedPackageId] = useState(packages.length > 0 ? packages[0]?.id : '');
  const [supplyQuantities, setSupplyQuantities] = useState<Record<string, number>>({});
  const [cleaningNotes, setCleaningNotes] = useState(order.cleaning_notes || '');
  const [cleaning, setCleaning] = useState(false);

  // Initialize supply quantities from package defaults
  const initSupplies = (pkgId: string) => {
    const items = packageItems.filter((pi: any) => pi.package_id === pkgId);
    const qty: Record<string, number> = {};
    items.forEach((pi: any) => { qty[pi.ingredient_id] = pi.default_quantity; });
    setSupplyQuantities(qty);
    setSelectedPackageId(pkgId);
  };

  // Auto-init when packages load
  if (packages.length > 0 && !selectedPackageId && Object.keys(supplyQuantities).length === 0) {
    initSupplies(packages[0].id);
  }

  const getIngredient = (id: string) => ingredients.find((i: any) => i.id === id);

  // ── Complete Inspection ──
  const completeInspection = async () => {
    setInspecting(true);
    try {
      const inspectionData = checklistItems.map((item: any) => ({
        id: item.id,
        label: item.item_label,
        checked: !!checkedItems[item.id],
        count: item.count_expected ? parseInt(itemCounts[item.id] || '0') : undefined,
        required: item.is_required,
      }));

      await from('housekeeping_orders').update({
        status: 'cleaning',
        inspection_data: inspectionData,
        damage_notes: damageNotes,
        assigned_to: assignedTo || null,
        inspection_completed_at: new Date().toISOString(),
      } as any).eq('id', order.id);

      qc.invalidateQueries({ queryKey: ['housekeeping-orders'] });
      toast.success('Inspection completed — proceed to cleaning');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete inspection');
    } finally {
      setInspecting(false);
    }
  };

  // ── Complete Cleaning (with inventory deduction) ──
  const completeCleaning = async () => {
    setCleaning(true);
    try {
      // 1. Deduct inventory
      for (const [ingredientId, qty] of Object.entries(supplyQuantities)) {
        if (qty <= 0) continue;
        const ing = getIngredient(ingredientId);
        if (!ing) continue;

        // Deduct from ingredients.current_stock
        await supabase.from('ingredients').update({
          current_stock: Math.max(0, (ing as any).current_stock - qty),
        }).eq('id', ingredientId);

        // Log to inventory_logs
        await supabase.from('inventory_logs').insert({
          ingredient_id: ingredientId,
          change_qty: -qty,
          reason: `housekeeping_clean:${order.unit_name}`,
        });
      }

      // 2. Update housekeeping order
      const suppliesUsed = Object.entries(supplyQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          ingredient_id: id,
          name: getIngredient(id)?.name || 'Unknown',
          quantity: qty,
        }));

      await from('housekeeping_orders').update({
        status: 'completed',
        cleaning_notes: cleaningNotes,
        supplies_used: suppliesUsed,
        cleaning_completed_at: new Date().toISOString(),
      } as any).eq('id', order.id);

      // 3. Set unit status to 'ready'
      await supabase.from('units').update({ status: 'ready' } as any)
        .eq('unit_name', order.unit_name);

      qc.invalidateQueries({ queryKey: ['housekeeping-orders'] });
      qc.invalidateQueries({ queryKey: ['rooms-units'] });
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success(`${order.unit_name} is now ready!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete cleaning');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h3 className="font-display text-lg tracking-wider text-foreground">
            {step === 'inspection' ? 'Room Inspection' : 'Cleaning'}
          </h3>
          <p className="font-body text-xs text-muted-foreground">{order.unit_name}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        <div className={`flex-1 h-1.5 rounded-full ${step === 'inspection' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <div className={`flex-1 h-1.5 rounded-full ${step === 'cleaning' ? 'bg-amber-500' : 'bg-muted'}`} />
      </div>

      {step === 'inspection' ? (
        /* ── STEP 1: INSPECTION ── */
        <div className="space-y-4">
          {/* Assign housekeeper */}
          <div>
            <label className="font-body text-xs text-muted-foreground">Assign to</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-secondary border-border text-foreground font-body mt-1">
                <SelectValue placeholder="Select housekeeper" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id} className="text-foreground font-body text-xs">
                    {e.display_name || e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checklist */}
          {checklistItems.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-display text-xs tracking-wider text-muted-foreground uppercase">Inspection Checklist</h4>
              {checklistItems.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 border border-border rounded p-3 min-h-[44px]">
                  <Checkbox
                    checked={!!checkedItems[item.id]}
                    onCheckedChange={v => setCheckedItems(prev => ({ ...prev, [item.id]: !!v }))}
                  />
                  <span className="font-body text-sm text-foreground flex-1">
                    {item.item_label}
                    {item.is_required && <span className="text-amber-400 text-xs ml-1">*</span>}
                  </span>
                  {item.count_expected && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={itemCounts[item.id] || ''}
                        onChange={e => setItemCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={`/${item.count_expected}`}
                        className="bg-secondary border-border text-foreground font-body h-8 w-16 text-xs text-center"
                      />
                      <span className="font-body text-xs text-muted-foreground">/{item.count_expected}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-xs text-muted-foreground">
              No checklist configured for this room type. You can add checklists in Setup → Housekeeping Config.
            </p>
          )}

          {/* Damage notes */}
          <div>
            <label className="font-body text-xs text-muted-foreground">Damage Report</label>
            <Textarea
              value={damageNotes}
              onChange={e => setDamageNotes(e.target.value)}
              placeholder="Describe any damage or missing items..."
              className="bg-secondary border-border text-foreground font-body text-sm min-h-[80px] mt-1"
            />
          </div>

          <Button
            onClick={completeInspection}
            disabled={inspecting}
            className="w-full font-display tracking-wider min-h-[44px]"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {inspecting ? 'Saving...' : 'Complete Inspection'}
          </Button>
        </div>
      ) : (
        /* ── STEP 2: CLEANING ── */
        <div className="space-y-4">
          {/* Package selector */}
          {packages.length > 0 && (
            <div>
              <label className="font-body text-xs text-muted-foreground">Cleaning Package</label>
              <Select value={selectedPackageId} onValueChange={initSupplies}>
                <SelectTrigger className="bg-secondary border-border text-foreground font-body mt-1">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {packages.map((pkg: any) => (
                    <SelectItem key={pkg.id} value={pkg.id} className="text-foreground font-body text-xs">
                      {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Supply quantities */}
          <div className="space-y-2">
            <h4 className="font-display text-xs tracking-wider text-muted-foreground uppercase">Supplies Used</h4>
            {Object.keys(supplyQuantities).length > 0 ? (
              Object.entries(supplyQuantities).map(([ingredientId, qty]) => {
                const ing = getIngredient(ingredientId);
                if (!ing) return null;
                return (
                  <div key={ingredientId} className="flex items-center gap-2 border border-border rounded p-2">
                    <span className="font-body text-sm text-foreground flex-1">
                      {(ing as any).name}
                    </span>
                    <Input
                      type="number"
                      value={qty}
                      onChange={e => setSupplyQuantities(prev => ({
                        ...prev,
                        [ingredientId]: parseFloat(e.target.value) || 0,
                      }))}
                      className="bg-secondary border-border text-foreground font-body h-8 w-20 text-xs text-center"
                    />
                    <span className="font-body text-xs text-muted-foreground w-12">{(ing as any).unit}</span>
                  </div>
                );
              })
            ) : (
              <p className="font-body text-xs text-muted-foreground">
                No cleaning package configured. You can add packages in Setup → Housekeeping Config.
              </p>
            )}
          </div>

          {/* Cleaning notes */}
          <div>
            <label className="font-body text-xs text-muted-foreground">Cleaning Notes</label>
            <Textarea
              value={cleaningNotes}
              onChange={e => setCleaningNotes(e.target.value)}
              placeholder="Additional notes..."
              className="bg-secondary border-border text-foreground font-body text-sm min-h-[60px] mt-1"
            />
          </div>

          <Button
            onClick={completeCleaning}
            disabled={cleaning}
            variant="default"
            className="w-full font-display tracking-wider min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {cleaning ? 'Completing...' : 'Cleaning Completed — Room Ready'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default HousekeepingInspection;
