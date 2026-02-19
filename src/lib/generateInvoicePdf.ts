import jsPDF from 'jspdf';
import { ResortProfile } from '@/hooks/useResortProfile';

interface InvoiceOrder {
  id: string;
  order_type: string;
  location_detail: string | null;
  items: any[];
  total: number;
  service_charge: number;
  payment_type: string | null;
  created_at: string;
}

// Use "P" for peso in PDF since jsPDF doesn't support the ₱ unicode glyph
function formatCurrency(amount: number): string {
  return `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export async function generateInvoicePdf(order: InvoiceOrder, profile: ResortProfile | null): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pw = doc.internal.pageSize.getWidth();
  const ml = 14; // margin left
  const mr = pw - 14; // margin right
  let y = 16;

  // ── Header: Resort name (light weight, spaced letters) ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  const resortName = (profile?.resort_name || 'Resort').toUpperCase();
  doc.text(resortName, pw / 2, y, { align: 'center', charSpace: 3 });
  y += 5;

  if (profile?.tagline) {
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(profile.tagline, pw / 2, y, { align: 'center' });
    y += 4;
  }

  // Thin accent line
  y += 2;
  doc.setDrawColor(200, 180, 140);
  doc.setLineWidth(0.4);
  doc.line(pw / 2 - 20, y, pw / 2 + 20, y);
  y += 8;

  // ── Business details (left) + Invoice meta (right) ──
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');

  const leftLines: string[] = [];
  if (profile?.address) leftLines.push(profile.address);
  const contactParts: string[] = [];
  if (profile?.phone) contactParts.push(profile.phone);
  if (profile?.email) contactParts.push(profile.email);
  if (contactParts.length) leftLines.push(contactParts.join('  ·  '));
  if (profile?.website_url) leftLines.push(profile.website_url);

  const leftY = y;
  leftLines.forEach((line, i) => {
    doc.text(line, ml, leftY + i * 4);
  });

  // Right side: date + type
  const orderDate = new Date(order.created_at).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const typeLabels: Record<string, string> = {
    Room: 'Room Delivery', DineIn: 'Dine In', Beach: 'Beach Delivery', WalkIn: 'Walk-In',
  };
  const typeLabel = typeLabels[order.order_type] || order.order_type;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.setFontSize(7);
  doc.text('DATE', mr, leftY, { align: 'right' });
  doc.text('TYPE', mr, leftY + 8, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(7.5);
  doc.text(orderDate, mr, leftY + 4, { align: 'right' });
  doc.text(`${typeLabel}${order.location_detail ? ` — ${order.location_detail}` : ''}`, mr, leftY + 12, { align: 'right' });

  y = leftY + Math.max(leftLines.length * 4, 16) + 4;

  // ── Invoice title ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 140, 100);
  doc.text('INVOICE', pw / 2, y, { align: 'center', charSpace: 4 });
  y += 8;

  // ── Table header ──
  doc.setFillColor(245, 243, 238);
  doc.rect(ml, y - 3.5, mr - ml, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('ITEM', ml + 2, y);
  doc.text('QTY', pw / 2 + 8, y, { align: 'center' });
  doc.text('PRICE', mr - 20, y, { align: 'right' });
  doc.text('TOTAL', mr - 2, y, { align: 'right' });
  y += 5;

  // ── Line items ──
  const items = order.items || [];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  items.forEach((item: any, idx: number) => {
    const qty = item.qty || item.quantity;
    const lineTotal = item.price * qty;

    // Alternate row tint
    if (idx % 2 === 0) {
      doc.setFillColor(250, 249, 247);
      doc.rect(ml, y - 3, mr - ml, 5, 'F');
    }

    doc.setTextColor(50, 50, 50);
    doc.text(item.name, ml + 2, y);
    doc.setTextColor(100, 100, 100);
    doc.text(String(qty), pw / 2 + 8, y, { align: 'center' });
    doc.text(formatCurrency(item.price), mr - 20, y, { align: 'right' });
    doc.setTextColor(50, 50, 50);
    doc.text(formatCurrency(lineTotal), mr - 2, y, { align: 'right' });
    y += 5;
  });

  // ── Divider ──
  y += 2;
  doc.setDrawColor(220, 220, 215);
  doc.setLineWidth(0.3);
  doc.line(ml, y, mr, y);
  y += 6;

  // ── Totals ──
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * (i.qty || i.quantity)), 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal', ml + 2, y);
  doc.text(formatCurrency(subtotal), mr - 2, y, { align: 'right' });
  y += 5;

  doc.text('Service Charge (10%)', ml + 2, y);
  doc.text(formatCurrency(order.service_charge), mr - 2, y, { align: 'right' });
  y += 6;

  // Grand total with accent background
  const grandTotal = subtotal + order.service_charge;
  doc.setFillColor(245, 243, 238);
  doc.rect(ml, y - 3.5, mr - ml, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text('TOTAL', ml + 2, y);
  doc.text(formatCurrency(grandTotal), mr - 2, y, { align: 'right' });
  y += 8;

  // ── Payment ──
  if (order.payment_type) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(`Payment: ${order.payment_type}`, ml + 2, y);
    y += 7;
  }

  // ── Footer ──
  y += 4;
  doc.setDrawColor(220, 220, 215);
  doc.setLineWidth(0.2);
  doc.line(pw / 2 - 15, y, pw / 2 + 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for dining with us', pw / 2, y, { align: 'center' });

  // ── Save ──
  doc.save(`invoice-${order.id.slice(0, 8)}.pdf`);
}

export function buildInvoiceWhatsAppText(order: InvoiceOrder, profile: ResortProfile | null): string {
  const typeLabels: Record<string, string> = {
    Room: 'Room Delivery', DineIn: 'Dine In', Beach: 'Beach Delivery', WalkIn: 'Walk-In',
  };
  const items = order.items || [];
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * (i.qty || i.quantity)), 0);

  const lines = [
    `*INVOICE - ${profile?.resort_name || 'Resort'}*`,
    '',
    `Date: ${new Date(order.created_at).toLocaleString('en-PH')}`,
    `Type: ${typeLabels[order.order_type] || order.order_type}${order.location_detail ? ` - ${order.location_detail}` : ''}`,
    '',
    '*Items:*',
    ...items.map((i: any) => `${i.qty || i.quantity}x ${i.name} - P${((i.price) * (i.qty || i.quantity)).toLocaleString()}`),
    '',
    `Subtotal: P${subtotal.toLocaleString()}`,
    `Service Charge (10%): P${order.service_charge.toLocaleString()}`,
    `*Total: P${order.total.toLocaleString()}*`,
  ];

  if (order.payment_type) lines.push(`Payment: ${order.payment_type}`);
  lines.push('', 'Thank you for dining with us!');
  if (profile?.website_url) lines.push(profile.website_url);

  return lines.join('\n');
}
