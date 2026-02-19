import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, AlertTriangle, Download, Package, UtensilsCrossed, BarChart3, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const UNITS = ['grams', 'ml', 'pcs', 'kg', 'liters', 'bottles', 'cans', 'slices'];

const InventoryDashboard = () => {
  const qc = useQueryClient();

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const { data } = await supabase.from('ingredients').select('*').order('name');
      return data || [];
    },
  });

  const { data: recipeLinks = [] } = useQuery({
    queryKey: ['recipe_ingredients_with_menu'],
    queryFn: async () => {
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('ingredient_id, menu_item_id, quantity, menu_items(name)');
      return data || [];
    },
  });

  // Consumption logs
  const [logDays, setLogDays] = useState(7);
  const { data: consumptionLogs = [] } = useQuery({
    queryKey: ['consumption-logs', logDays],
    queryFn: async () => {
      const since = subDays(new Date(), logDays).toISOString();
      const { data } = await supabase
        .from('inventory_logs')
        .select('*, ingredients(name, unit)')
        .eq('reason', 'order_deduction')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Build usage map
  const usageMap: Record<string, { dishName: string; quantity: number }[]> = {};
  recipeLinks.forEach((rl: any) => {
    const dishName = rl.menu_items?.name || 'Unknown';
    if (!usageMap[rl.ingredient_id]) usageMap[rl.ingredient_id] = [];
    usageMap[rl.ingredient_id].push({ dishName, quantity: rl.quantity });
  });

  // Dashboard stats
  const totalValue = ingredients.reduce((sum: number, i: any) => sum + (i.current_stock * i.cost_per_unit), 0);
  const missingCostCount = ingredients.filter((i: any) => i.cost_per_unit === 0).length;
  const outOfStockCount = ingredients.filter((i: any) => i.current_stock <= 0).length;

  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | out
  const [editIng, setEditIng] = useState<any>(null);
  const [form, setForm] = useState({ name: '', unit: 'grams', cost_per_unit: '', current_stock: '', low_stock_threshold: '' });

  const openNew = () => {
    setEditIng('new');
    setForm({ name: '', unit: 'grams', cost_per_unit: '', current_stock: '', low_stock_threshold: '' });
  };

  const openEdit = (ing: any) => {
    setEditIng(ing);
    setForm({
      name: ing.name,
      unit: ing.unit,
      cost_per_unit: String(ing.cost_per_unit),
      current_stock: String(ing.current_stock),
      low_stock_threshold: String(ing.low_stock_threshold),
    });
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 0,
    };
    if (!payload.name) return;

    if (editIng === 'new') {
      await supabase.from('ingredients').insert(payload);
    } else {
      const oldStock = editIng.current_stock;
      if (payload.current_stock !== oldStock) {
        await supabase.from('inventory_logs').insert({
          ingredient_id: editIng.id,
          change_qty: payload.current_stock - oldStock,
          reason: 'manual_adjustment',
        });
      }
      await supabase.from('ingredients').update(payload).eq('id', editIng.id);
    }
    setEditIng(null);
    qc.invalidateQueries({ queryKey: ['ingredients'] });
    toast.success('Ingredient saved');
  };

  const deleteIng = async (id: string) => {
    await supabase.from('ingredients').delete().eq('id', id);
    setEditIng(null);
    qc.invalidateQueries({ queryKey: ['ingredients'] });
    toast.success('Ingredient deleted');
  };

  const lowStockItems = ingredients.filter((i: any) => i.current_stock < i.low_stock_threshold && i.low_stock_threshold > 0);

  const filtered = ingredients.filter((i: any) => {
    if (search.trim() && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (unitFilter !== 'all' && i.unit !== unitFilter) return false;
    if (stockFilter === 'low' && !(i.current_stock < i.low_stock_threshold && i.low_stock_threshold > 0)) return false;
    if (stockFilter === 'out' && i.current_stock > 0) return false;
    return true;
  });

  const downloadCSV = () => {
    let csv = 'Name,Unit,Cost Per Unit,Current Stock,Low Stock Threshold,Status\n';
    ingredients.forEach((i: any) => {
      const status = i.current_stock <= i.low_stock_threshold && i.low_stock_threshold > 0 ? 'LOW' : 'OK';
      csv += `"${i.name}","${i.unit}",${i.cost_per_unit},${i.current_stock},${i.low_stock_threshold},${status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const editIngUsage = editIng && editIng !== 'new' ? (usageMap[editIng.id] || []) : [];

  // Group consumption logs by date and ingredient
  const logsByDate: Record<string, Record<string, { name: string; total: number; unit: string }>> = {};
  consumptionLogs.forEach((log: any) => {
    const date = format(new Date(log.created_at), 'yyyy-MM-dd');
    const ingName = log.ingredients?.name || 'Unknown';
    const ingUnit = log.ingredients?.unit || '';
    if (!logsByDate[date]) logsByDate[date] = {};
    if (!logsByDate[date][ingName]) logsByDate[date][ingName] = { name: ingName, total: 0, unit: ingUnit };
    logsByDate[date][ingName].total += Math.abs(log.change_qty);
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="w-full bg-secondary mb-4">
          <TabsTrigger value="stock" className="font-display text-xs tracking-wider flex-1">
            <Package className="w-3.5 h-3.5 mr-1" /> Stock
          </TabsTrigger>
          <TabsTrigger value="consumption" className="font-display text-xs tracking-wider flex-1">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Usage Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg border border-border bg-secondary/50 text-center">
              <p className="font-display text-lg text-foreground">₱{totalValue.toLocaleString()}</p>
              <p className="font-body text-[10px] text-cream-dim">Inventory Value</p>
            </div>
            <button onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
              className={`p-2.5 rounded-lg border text-center transition-colors ${
                outOfStockCount > 0 ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-secondary/50'
              }`}>
              <p className="font-display text-lg text-foreground">{outOfStockCount}</p>
              <p className="font-body text-[10px] text-cream-dim">Out of Stock</p>
            </button>
            <button onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
              className={`p-2.5 rounded-lg border text-center transition-colors ${
                lowStockItems.length > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-secondary/50'
              }`}>
              <p className="font-display text-lg text-foreground">{lowStockItems.length}</p>
              <p className="font-body text-[10px] text-cream-dim">Low Stock</p>
            </button>
          </div>

          {/* Missing cost alert */}
          {missingCostCount > 0 && (
            <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="font-body text-xs text-foreground">
                {missingCostCount} ingredient{missingCostCount !== 1 ? 's' : ''} missing cost data — food costing won't be accurate
              </p>
            </div>
          )}

          {/* Low stock alerts */}
          {lowStockItems.length > 0 && stockFilter === 'all' && (
            <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="font-display text-xs tracking-wider text-destructive">Low Stock Alert</span>
              </div>
              {lowStockItems.map((i: any) => (
                <p key={i.id} className="font-body text-xs text-foreground">
                  {i.name}: {i.current_stock} {i.unit} (threshold: {i.low_stock_threshold})
                </p>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ingredients..."
              className="bg-secondary border-border text-foreground font-body flex-1"
            />
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="bg-secondary border-border text-foreground font-body w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="font-body text-foreground">All</SelectItem>
                <SelectItem value="pcs" className="font-body text-foreground">pcs</SelectItem>
                <SelectItem value="grams" className="font-body text-foreground">grams</SelectItem>
                <SelectItem value="ml" className="font-body text-foreground">ml</SelectItem>
                <SelectItem value="slices" className="font-body text-foreground">slices</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={openNew} className="font-display tracking-wider w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Add Ingredient
          </Button>

          {/* Ingredients list */}
          {filtered.map((ing: any) => {
            const isLow = ing.current_stock < ing.low_stock_threshold && ing.low_stock_threshold > 0;
            const isOut = ing.current_stock <= 0;
            const noCost = ing.cost_per_unit === 0;
            const dishCount = (usageMap[ing.id] || []).length;
            return (
              <button key={ing.id} onClick={() => openEdit(ing)}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  isOut ? 'border-destructive/60 bg-destructive/10' :
                  isLow ? 'border-destructive/40 bg-destructive/5' : 'border-border hover:border-gold/50'
                }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-cream-dim" />
                      <p className="font-display text-sm text-foreground">{ing.name}</p>
                      {isOut && <Badge variant="destructive" className="text-[10px] py-0">OUT</Badge>}
                      {isLow && !isOut && <Badge variant="destructive" className="text-[10px] py-0">LOW</Badge>}
                      {noCost && <Badge variant="outline" className="text-[10px] py-0 border-amber-500/50 text-amber-400">No Cost</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-body text-xs text-cream-dim">
                        {noCost ? '₱—' : `₱${ing.cost_per_unit}`}/{ing.unit}
                      </p>
                      {dishCount > 0 && (
                        <span className="font-body text-xs text-muted-foreground">
                          · {dishCount} {dishCount === 1 ? 'dish' : 'dishes'}
                        </span>
                      )}
                      {dishCount === 0 && (
                        <span className="font-body text-xs text-muted-foreground">· No recipe</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-sm ${isOut ? 'text-destructive' : 'text-foreground'}`}>{ing.current_stock}</p>
                    <p className="font-body text-[10px] text-cream-dim">{ing.unit}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <p className="font-body text-sm text-cream-dim text-center py-8">No ingredients found</p>
          )}
        </TabsContent>

        {/* CONSUMPTION LOG TAB */}
        <TabsContent value="consumption" className="space-y-4">
          <div className="flex gap-2">
            {[7, 14, 30].map(d => (
              <Button key={d} size="sm" variant={logDays === d ? 'default' : 'outline'}
                onClick={() => setLogDays(d)} className="font-body text-xs flex-1">
                {d}d
              </Button>
            ))}
          </div>

          {Object.keys(logsByDate).length === 0 ? (
            <p className="font-body text-sm text-cream-dim text-center py-8">No consumption data yet</p>
          ) : (
            Object.entries(logsByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, ings]) => (
                <div key={date} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-cream-dim" />
                    <span className="font-display text-xs tracking-wider text-foreground">
                      {format(new Date(date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {Object.values(ings)
                    .sort((a, b) => b.total - a.total)
                    .map((ing, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="font-body text-xs text-foreground">{ing.name}</span>
                        <span className="font-body text-xs text-cream-dim">-{ing.total} {ing.unit}</span>
                      </div>
                    ))
                  }
                </div>
              ))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editIng} onOpenChange={() => setEditIng(null)}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground tracking-wider">
              {editIng === 'new' ? 'New Ingredient' : 'Edit Ingredient'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ingredient name" className="bg-secondary border-border text-foreground font-body" />
            <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
              <SelectTrigger className="bg-secondary border-border text-foreground font-body"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {UNITS.map(u => (
                  <SelectItem key={u} value={u} className="font-body text-foreground">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <label className="font-body text-xs text-cream-dim">Cost per unit (₱)</label>
              <Input value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                type="number" className="bg-secondary border-border text-foreground font-body mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-body text-xs text-cream-dim">Current Stock</label>
                <Input value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))}
                  type="number" className="bg-secondary border-border text-foreground font-body mt-1" />
              </div>
              <div>
                <label className="font-body text-xs text-cream-dim">Low Threshold</label>
                <Input value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                  type="number" className="bg-secondary border-border text-foreground font-body mt-1" />
              </div>
            </div>

            {/* Used in dishes section */}
            {editIngUsage.length > 0 && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-cream-dim" />
                  <span className="font-display text-xs tracking-wider text-foreground">
                    Used in {editIngUsage.length} {editIngUsage.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                {editIngUsage
                  .sort((a, b) => a.dishName.localeCompare(b.dishName))
                  .map((u, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="font-body text-xs text-foreground">{u.dishName}</span>
                    <span className="font-body text-[10px] text-cream-dim">{u.quantity} per order</span>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={save} className="font-display tracking-wider w-full">Save</Button>
            {editIng && editIng !== 'new' && (
              <Button variant="destructive" onClick={() => deleteIng(editIng.id)} className="font-display tracking-wider w-full">
                Delete Ingredient
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryDashboard;
