import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, AlertCircle, Search, Package, Wine, Utensils, Bed, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface Asset {
  id: string;
  name: string;
  department: string;
  current_quantity: number;
  min_quantity: number;
  unit: string;
  breakage_count: number;
  last_restocked: string | null;
}

export default function NonFoodInventory() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [breakageDialog, setBreakageDialog] = useState<any>({ open: false, asset: null, quantity: 1, reason: '' });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    current_quantity: 0,
    min_quantity: 0,
    unit: 'pcs'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAssets();
  }, [selectedDepartment]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      let query = supabase.from('assets').select('*');
      
      if (selectedDepartment !== 'all') {
        query = query.eq('department', selectedDepartment);
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

  const handleDelete = async (id: string) => {
    if (confirm('Delete this item?')) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) throw error;
        await loadAssets();
        toast({ title: 'Deleted', description: 'Item removed' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
      }
    }
  };

  const openAddDialog = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      department: '',
      current_quantity: 0,
      min_quantity: 0,
      unit: 'pcs'
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      department: asset.department,
      current_quantity: asset.current_quantity,
      min_quantity: asset.min_quantity,
      unit: asset.unit
    });
    setIsDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!formData.name || !formData.department) {
      toast({ title: 'Error', description: 'Name and Department are required', variant: 'destructive' });
      return;
    }

    try {
      if (editingAsset) {
        const { error } = await supabase
          .from('assets')
          .update({
            name: formData.name,
            department: formData.department,
            current_quantity: formData.current_quantity,
            min_quantity: formData.min_quantity,
            unit: formData.unit,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAsset.id);
        
        if (error) {
          console.error('Update error:', error);
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Updated', description: 'Item saved' });
      } else {
        const { error } = await supabase
          .from('assets')
          .insert({
            name: formData.name,
            department: formData.department,
            current_quantity: formData.current_quantity,
            min_quantity: formData.min_quantity,
            unit: formData.unit,
            breakage_count: 0
          });
        
        if (error) {
          console.error('Insert error:', error);
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Added', description: 'New item created' });
      }
      await loadAssets();
      setIsDialogOpen(false);
      setEditingAsset(null);
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
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
          updated_at: new Date().toISOString()
        })
        .eq('id', breakageDialog.asset.id);
      
      if (updateError) throw updateError;
      
      await supabase.from('asset_transactions').insert({
        asset_id: breakageDialog.asset.id,
        quantity_change: -breakageDialog.quantity,
        transaction_type: 'BREAKAGE',
        reason: breakageDialog.reason,
        performed_by: 'Staff'
      });
      
      await loadAssets();
      setBreakageDialog({ open: false, asset: null, quantity: 1, reason: '' });
      toast({ title: 'Logged', description: `${breakageDialog.quantity} broken item(s) recorded` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
          updated_at: new Date().toISOString()
        })
        .eq('id', asset.id);
      
      if (error) throw error;
      
      await supabase.from('asset_transactions').insert({
        asset_id: asset.id,
        quantity_change: parseInt(quantity),
        transaction_type: 'RESTOCK',
        reason: 'New stock received',
        performed_by: 'Staff'
      });
      
      await loadAssets();
      toast({ title: 'Restocked', description: `Added ${quantity} ${asset.unit}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = `Item Name,Department,Current Quantity,Min Quantity,Unit\nRed Wine Glass,Bar,50,30,pcs\nDinner Plate,Kitchen,100,50,pcs\nBath Towel,Rooms,30,20,pcs`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setCsvText('');
    }
  };

  const processImport = async (csvData: string) => {
    if (!csvData.trim()) {
      toast({ title: 'Error', description: 'No data to import', variant: 'destructive' });
      return;
    }

    const lines = csvData.trim().split('\n');
    const items = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 5) {
        items.push({
          name: cols[0].trim(),
          department: cols[1].trim(),
          current_quantity: parseInt(cols[2]) || 0,
          min_quantity: parseInt(cols[3]) || 0,
          unit: cols[4].trim() || 'pcs',
          breakage_count: 0
        });
      }
    }

    if (items.length === 0) {
      toast({ title: 'Error', description: 'No valid data found', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('assets').insert(items);
      if (error) throw error;
      await loadAssets();
      setIsBulkDialogOpen(false);
      setCsvText('');
      setUploadedFile(null);
      toast({ title: 'Success', description: `${items.length} items imported` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkImport = async () => {
    setImporting(true);
    
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvData = e.target?.result as string;
        await processImport(csvData);
        setImporting(false);
      };
      reader.readAsText(uploadedFile);
    } else if (csvText.trim()) {
      await processImport(csvText);
      setImporting(false);
    } else {
      toast({ title: 'Error', description: 'Please upload a CSV file or paste data', variant: 'destructive' });
      setImporting(false);
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedDepartment === 'all' || asset.department === selectedDepartment)
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

  const getDepartmentColor = (department: string) => {
    switch(department) {
      case 'Bar': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Kitchen': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Rooms': return 'bg-sky-100 text-sky-800 border-sky-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center sticky top-0 bg-navy-texture z-10 py-2">
        <div>
          <h1 className="text-xl font-bold">Non-Food Inventory</h1>
          <p className="text-xs text-muted-foreground">Glasses, plates, tools, appliances</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsBulkDialogOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Bulk
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAssets.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Low Stock Alerts</span>
          </div>
          <div className="space-y-2">
            {lowStockAssets.map(asset => (
              <div key={asset.id} className="flex justify-between items-center bg-white rounded p-2">
                <div>
                  <p className="font-medium text-sm">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-600 font-bold text-sm">{asset.current_quantity} / {asset.min_quantity} {asset.unit}</p>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleRestock(asset)}>
                    Restock
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-2 sticky top-[60px] bg-navy-texture z-10 py-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <select 
          value={selectedDepartment} 
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-white text-black text-sm"
        >
          <option value="all">All Depts</option>
          <option value="Bar">🍸 Bar</option>
          <option value="Kitchen">🍽️ Kitchen</option>
          <option value="Rooms">🛏️ Rooms</option>
        </select>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No items found. Click "Add" or "Bulk Import" to add items.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">{asset.name}</h3>
                    <Badge className={`mt-1 text-xs ${getDepartmentColor(asset.department)}`}>
                      {getDepartmentIcon(asset.department)}
                      <span className="ml-1">{asset.department}</span>
                    </Badge>
                  </div>
                  {asset.current_quantity < asset.min_quantity && (
                    <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Current Stock</p>
                    <p className={`font-bold text-lg ${asset.current_quantity < asset.min_quantity ? 'text-red-600' : ''}`}>
                      {asset.current_quantity} <span className="text-xs font-normal text-muted-foreground">{asset.unit}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Min Required</p>
                    <p className="font-medium">{asset.min_quantity} {asset.unit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Breakage (Total)</p>
                    <p className="font-medium text-orange-600">{asset.breakage_count} {asset.unit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Last Restocked</p>
                    <p className="text-xs">{asset.last_restocked || 'Never'}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" className="flex-1 text-sm" onClick={() => handleRestock(asset)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Restock
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 text-sm" onClick={() => setBreakageDialog({ open: true, asset, quantity: 1, reason: '' })}>
                    Broken -1
                  </Button>
                  <Button size="sm" variant="outline" className="px-3" onClick={() => openEditDialog(asset)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="px-3" onClick={() => handleDelete(asset.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Item Name</label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Red Wine Glass" 
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Department</label>
              <select 
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-white text-black"
              >
                <option value="">Select department</option>
                <option value="Bar">🍸 Bar</option>
                <option value="Kitchen">🍽️ Kitchen</option>
                <option value="Rooms">🛏️ Rooms</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Current Qty</label>
                <Input 
                  type="number" 
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({ ...formData, current_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Min Qty</label>
                <Input 
                  type="number" 
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Unit</label>
              <Input 
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="pcs" 
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSaveAsset}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Import CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Step 1: Download Template */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2">1. Download Template</h3>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
                📥 Download Template CSV
              </Button>
            </div>

            {/* Step 2: Upload File */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2">2. Upload Your CSV</h3>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              {uploadedFile && (
                <p className="text-xs text-green-600 mt-2">✓ {uploadedFile.name}</p>
              )}
            </div>

            {/* OR Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-500">OR</span>
              </div>
            </div>

            {/* Step 3: Paste as fallback */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2">3. Paste CSV Data (Optional)</h3>
              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setUploadedFile(null);
                }}
                className="w-full h-32 p-3 rounded-md border border-input bg-gray-50 text-gray-900 font-mono text-sm"
                placeholder="Item Name,Department,Current Quantity,Min Quantity,Unit&#10;Red Wine Glass,Bar,50,30,pcs"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => {
              setIsBulkDialogOpen(false);
              setCsvText('');
              setUploadedFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Breakage Dialog */}
      <Dialog open={breakageDialog.open} onOpenChange={(open) => !open && setBreakageDialog({ ...breakageDialog, open: false })}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Log Breakage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded">
              <p className="font-medium">{breakageDialog.asset?.name}</p>
              <p className="text-sm">Current: {breakageDialog.asset?.current_quantity} {breakageDialog.asset?.unit}</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Quantity Broken</label>
              <Input 
                type="number" 
                min="1" 
                value={breakageDialog.quantity} 
                onChange={(e) => setBreakageDialog({ ...breakageDialog, quantity: parseInt(e.target.value) || 1 })} 
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Reason</label>
              <select 
                value={breakageDialog.reason} 
                onChange={(e) => setBreakageDialog({ ...breakageDialog, reason: e.target.value })} 
                className="w-full h-10 px-3 rounded-md border border-input bg-white text-black"
              >
                <option value="">Select reason</option>
                <option value="Guest dropped">Guest dropped</option>
                <option value="Staff accident">Staff accident</option>
                <option value="Normal wear">Normal wear & tear</option>
                <option value="Lost">Lost / Missing</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBreakageDialog({ ...breakageDialog, open: false })}>Cancel</Button>
              <Button onClick={handleBreakage}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
