import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, AlertCircle, Search, Package, Wine, Utensils, Bed, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface Asset {
  id: string;
  name: string;
  category_id: string;
  current_quantity: number;
  min_quantity: number;
  unit: string;
  breakage_count: number;
  last_restocked: string | null;
  category?: {
    id: string;
    name: string;
    department: string;
  };
}

export default function NonFoodInventory() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [breakageDialog, setBreakageDialog] = useState<any>({ open: false, asset: null, quantity: 1, reason: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAssets();
    loadCategories();
  }, [selectedDepartment]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('assets')
        .select(`
          *,
          category:asset_categories(*)
        `);
      
      if (selectedDepartment !== 'all') {
        query = query.eq('category.department', selectedDepartment);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast({ title: 'Error', description: 'Failed to load inventory', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) throw error;
        await loadAssets();
        toast({ title: 'Success', description: 'Item deleted successfully' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
      }
    }
  };

  const handleSaveAsset = async (assetData: any) => {
    try {
      if (editingAsset) {
        const { error } = await supabase
          .from('assets')
          .update({ ...assetData, updated_at: new Date() })
          .eq('id', editingAsset.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Item updated successfully' });
      } else {
        const { error } = await supabase
          .from('assets')
          .insert([{ ...assetData, breakage_count: 0 }]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Item created successfully' });
      }
      await loadAssets();
      setIsDialogOpen(false);
      setEditingAsset(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save item', variant: 'destructive' });
    }
  };

  const handleBreakage = async () => {
    if (!breakageDialog.asset) return;
    
    try {
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          current_quantity: breakageDialog.asset.current_quantity - breakageDialog.quantity,
          breakage_count: breakageDialog.asset.breakage_count + breakageDialog.quantity,
          updated_at: new Date()
        })
        .eq('id', breakageDialog.asset.id);
      
      if (updateError) throw updateError;
      
      const { error: transactionError } = await supabase
        .from('asset_transactions')
        .insert([{
          asset_id: breakageDialog.asset.id,
          quantity_change: -breakageDialog.quantity,
          transaction_type: 'BREAKAGE',
          reason: breakageDialog.reason,
          performed_by: 'Staff'
        }]);
      
      if (transactionError) throw transactionError;
      
      await loadAssets();
      setBreakageDialog({ open: false, asset: null, quantity: 1, reason: '' });
      toast({ title: 'Success', description: 'Breakage logged successfully' });
    } catch (error) {
      console.error('Error logging breakage:', error);
      toast({ title: 'Error', description: 'Failed to log breakage', variant: 'destructive' });
    }
  };

  const handleRestock = async (asset: Asset) => {
    const quantity = prompt(`How many ${asset.unit} to add?`, '10');
    if (!quantity) return;
    
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          current_quantity: asset.current_quantity + parseInt(quantity),
          last_restocked: new Date().toISOString().split('T')[0],
          updated_at: new Date()
        })
        .eq('id', asset.id);
      
      if (error) throw error;
      
      await supabase.from('asset_transactions').insert([{
        asset_id: asset.id,
        quantity_change: parseInt(quantity),
        transaction_type: 'RESTOCK',
        reason: 'New stock received',
        performed_by: 'Staff'
      }]);
      
      await loadAssets();
      toast({ title: 'Success', description: `Added ${quantity} ${asset.unit}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to restock', variant: 'destructive' });
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockAssets = assets.filter(asset => asset.current_quantity < asset.min_quantity);

  const getDepartmentIcon = (department: string) => {
    switch(department) {
      case 'Bar': return <Wine className="h-4 w-4" />;
      case 'Kitchen': return <Utensils className="h-4 w-4" />;
      case 'Rooms': return <Bed className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Non-Food Inventory</h1>
          <p className="text-muted-foreground">Manage glasses, plates, tools, and appliances by department</p>
        </div>
        <Button onClick={() => {
          setEditingAsset(null);
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAssets.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Low Stock Alerts - Need to Reorder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockAssets.map(asset => (
                <div key={asset.id} className="flex justify-between items-center p-2 bg-white rounded">
                  <div className="flex items-center gap-2">
                    {getDepartmentIcon(asset.category?.department || '')}
                    <span className="font-medium">{asset.name}</span>
                    <span className="text-sm text-muted-foreground">({asset.category?.department})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-red-600 font-bold">
                      {asset.current_quantity} / {asset.min_quantity} {asset.unit}
                    </span>
                    <Button size="sm" onClick={() => handleRestock(asset)}>Restock Now</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Bar">🍸 Bar</SelectItem>
            <SelectItem value="Kitchen">🍽️ Kitchen</SelectItem>
            <SelectItem value="Rooms">🛏️ Rooms</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr className="text-left">
                  <th className="p-4 font-medium">Item</th>
                  <th className="p-4 font-medium">Department</th>
                  <th className="p-4 font-medium">Current Stock</th>
                  <th className="p-4 font-medium">Min Required</th>
                  <th className="p-4 font-medium">Breakage</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8">Loading...</td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">No items found</td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-medium">{asset.name}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getDepartmentIcon(asset.category?.department || '')}
                          {asset.category?.department}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className={asset.current_quantity < asset.min_quantity ? 'text-red-600 font-bold' : 'font-medium'}>
                          {asset.current_quantity} {asset.unit}
                        </span>
                      </td>
                      <td className="p-4">{asset.min_quantity} {asset.unit}</td>
                      <td className="p-4 text-orange-600">{asset.breakage_count} {asset.unit}</td>
                      <td className="p-4">
                        {asset.current_quantity < asset.min_quantity ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">OK</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleRestock(asset)}>
                            + Restock
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setBreakageDialog({ open: true, asset, quantity: 1, reason: '' })}>
                            Broken -1
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingAsset(asset);
                            setIsDialogOpen(true);
                          }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(asset.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <AssetForm
            asset={editingAsset}
            categories={categories}
            onSave={handleSaveAsset}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingAsset(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Breakage Dialog */}
      <Dialog open={breakageDialog.open} onOpenChange={(open) => !open && setBreakageDialog({ ...breakageDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Breakage - {breakageDialog.asset?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <div className="text-sm text-yellow-800">
                Current stock: <strong>{breakageDialog.asset?.current_quantity} {breakageDialog.asset?.unit}</strong>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Quantity Broken</label>
              <Input
                type="number"
                min="1"
                max={breakageDialog.asset?.current_quantity}
                value={breakageDialog.quantity}
                onChange={(e) => setBreakageDialog({ ...breakageDialog, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Select value={breakageDialog.reason} onValueChange={(value) => setBreakageDialog({ ...breakageDialog, reason: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Guest dropped">Guest dropped</SelectItem>
                  <SelectItem value="Staff accident">Staff accident</SelectItem>
                  <SelectItem value="Normal wear">Normal wear and tear</SelectItem>
                  <SelectItem value="Lost">Lost / Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setBreakageDialog({ ...breakageDialog, open: false })}>
                Cancel
              </Button>
              <Button onClick={handleBreakage}>
                Confirm Breakage
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Asset Form Component
function AssetForm({ asset, categories, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    category_id: asset?.category_id || '',
    current_quantity: asset?.current_quantity || 0,
    min_quantity: asset?.min_quantity || 0,
    unit: asset?.unit || 'pcs'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Item Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Red Wine Glass, Blender, Dinner Plate"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Category / Department</label>
        <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name} ({cat.department})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Current Quantity</label>
          <Input
            type="number"
            value={formData.current_quantity}
            onChange={(e) => setFormData({ ...formData, current_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Min Quantity (Alert)</label>
          <Input
            type="number"
            value={formData.min_quantity}
            onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Unit</label>
        <Input
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          placeholder="pcs, sets, units"
        />
      </div>
      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
