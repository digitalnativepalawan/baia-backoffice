import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';

const CHART_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--accent))', '#22c55e', '#eab308', '#ef4444',
  '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#ec4899',
  '#6366f1', '#84cc16', '#06b6d4', '#f43f5e',
];

interface ExpenseReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: any[];
  monthLabel: string;
  onCategoryClick: (category: string) => void;
}

const ExpenseReportsModal = ({ open, onOpenChange, expenses, monthLabel, onCategoryClick }: ExpenseReportsModalProps) => {
  const fmt = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const totalAmount = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach(e => {
      const cat = e.category || 'Uncategorized';
      const cur = map.get(cat) || { total: 0, count: 0 };
      cur.total += Number(e.amount || 0);
      cur.count += 1;
      map.set(cat, cur);
    });
    return Array.from(map.entries())
      .map(([category, { total, count }]) => ({
        category,
        total,
        count,
        pct: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, totalAmount]);

  const categoriesUsed = breakdown.length;

  const exportCSV = () => {
    const rows = [['Category', 'Total Amount', '# of Expenses', '% of Total']];
    breakdown.forEach(r => rows.push([r.category, r.total.toFixed(2), String(r.count), r.pct.toFixed(1) + '%']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${monthLabel.replace(/\s/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Expense Report - ${monthLabel}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ₱${fmt(totalAmount)} | Categories: ${categoriesUsed}`, 14, 30);

    let y = 42;
    doc.setFontSize(9);
    doc.text('Category', 14, y);
    doc.text('Amount', 100, y);
    doc.text('Count', 140, y);
    doc.text('% Total', 165, y);
    y += 6;
    breakdown.forEach(r => {
      doc.text(r.category, 14, y);
      doc.text(`₱${fmt(r.total)}`, 100, y);
      doc.text(String(r.count), 140, y);
      doc.text(`${r.pct.toFixed(1)}%`, 165, y);
      y += 5;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save(`expense-report-${monthLabel.replace(/\s/g, '-')}.pdf`);
  };

  const handleCategoryClick = (category: string) => {
    onCategoryClick(category);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">Expense Report — {monthLabel}</DialogTitle>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded border border-border bg-secondary">
            <p className="font-body text-xs text-muted-foreground">Total Expenses</p>
            <p className="font-display text-lg text-foreground">₱{fmt(totalAmount)}</p>
          </div>
          <div className="p-3 rounded border border-border bg-secondary">
            <p className="font-body text-xs text-muted-foreground">Categories Used</p>
            <p className="font-display text-lg text-foreground">{categoriesUsed}</p>
          </div>
        </div>

        {/* Bar chart */}
        {breakdown.length > 0 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <XAxis type="number" tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} className="font-body text-xs" />
                <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 10 }} className="font-body" />
                <Tooltip formatter={(v: number) => [`₱${fmt(v)}`, 'Amount']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {breakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body text-xs">Category</TableHead>
              <TableHead className="font-body text-xs text-right">Total</TableHead>
              <TableHead className="font-body text-xs text-right">#</TableHead>
              <TableHead className="font-body text-xs text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map(r => (
              <TableRow key={r.category} className="cursor-pointer hover:bg-accent/50" onClick={() => handleCategoryClick(r.category)}>
                <TableCell className="font-body text-sm">{r.category}</TableCell>
                <TableCell className="font-body text-sm text-right">₱{fmt(r.total)}</TableCell>
                <TableCell className="font-body text-sm text-right">{r.count}</TableCell>
                <TableCell className="font-body text-sm text-right">{r.pct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Export buttons */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseReportsModal;
