import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Food & Beverage', 'Utilities (Electric/Water/Gas/Fuel)', 'Labor/Staff', 'Housekeeping',
  'Maintenance/Repairs', 'Operations/Supplies', 'Marketing/Admin', 'Professional Services',
  'Permits/Licenses', 'Transportation', 'Guest Services', 'Taxes/Government',
  'Capital Expenditures', 'Miscellaneous',
];

interface ExpenseBulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const ExpenseBulkImportModal = ({ open, onOpenChange, onComplete }: ExpenseBulkImportModalProps) => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; errorDetails: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const header = 'Date,Name,Category,Amount,Notes,Image URL';
    const example = '02/15/2026,Electric Bill,Utilities (Electric/Water/Gas/Fuel),5000,Monthly bill,';
    const csv = [header, example].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseDate = (raw: string): string | null => {
    // Accept mm/dd/yyyy or yyyy-mm-dd
    const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      const [, m, d, y] = mdyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) return raw;
    return null;
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      toast.error('CSV must have a header + at least one data row');
      setImporting(false);
      return;
    }

    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 4) { errors.push(`Row ${i}: Not enough columns`); continue; }
      const [dateRaw, name, category, amountRaw, notes, image_url] = cols;
      const date = parseDate(dateRaw);
      if (!date) { errors.push(`Row ${i}: Invalid date "${dateRaw}"`); continue; }
      if (!name) { errors.push(`Row ${i}: Missing name`); continue; }
      const amount = parseFloat(amountRaw);
      if (isNaN(amount)) { errors.push(`Row ${i}: Invalid amount "${amountRaw}"`); continue; }

      rows.push({
        expense_date: date,
        name,
        category: EXPENSE_CATEGORIES.includes(category) ? category : category || 'Miscellaneous',
        amount,
        notes: notes || null,
        image_url: image_url || null,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('resort_ops_expenses' as any).insert(rows as any);
      if (error) {
        errors.push(`DB error: ${error.message}`);
      }
    }

    setResult({ success: rows.length, errors: errors.length, errorDetails: errors });
    if (rows.length > 0) {
      onComplete();
      toast.success(`Imported ${rows.length} expenses`);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">Bulk Import Expenses</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            Download the CSV template, fill it in, then upload to bulk import expenses.
          </p>

          <Button size="sm" variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download CSV Template
          </Button>

          <div className="space-y-2">
            <label className="font-body text-xs text-muted-foreground">Upload CSV file</label>
            <Input type="file" accept=".csv" ref={fileRef} className="bg-secondary border-border text-foreground font-body" />
          </div>

          <Button size="sm" onClick={handleImport} disabled={importing} className="w-full">
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {importing ? 'Importing...' : 'Import'}
          </Button>

          {result && (
            <div className="p-3 rounded border border-border bg-secondary space-y-1">
              <p className="font-body text-sm text-foreground">
                ✅ {result.success} imported · ❌ {result.errors} errors
              </p>
              {result.errorDetails.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  {result.errorDetails.map((e, i) => (
                    <p key={i} className="font-body text-xs text-destructive">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseBulkImportModal;
