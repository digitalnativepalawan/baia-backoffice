import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

type ExtractedFields = {
  total: string;
  date: string;
};

type Props = {
  onExtracted: (fields: ExtractedFields) => void;
};

/** Fix image orientation using canvas before OCR */
const fixOrientation = (file: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = url;
  });
};

/** Extract total amount from OCR text */
const extractTotal = (text: string): string => {
  // Look for patterns like "TOTAL 1,234.56", "Total: ₱1234", "PHP 500.00", "$12.50"
  const patterns = [
    /(?:total|grand\s*total|amount\s*due|balance\s*due|net\s*amount)[:\s]*[₱$]?\s*([\d,]+\.?\d{0,2})/i,
    /[₱$]\s*([\d,]+\.\d{2})/,
    /(?:PHP|USD)\s*([\d,]+\.?\d{0,2})/i,
    /(?:total|amount)[:\s]*([\d,]+\.\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(/,/g, '');
    }
  }
  return '';
};

/** Extract date from OCR text */
const extractDate = (text: string): string => {
  // MM/DD/YY or MM/DD/YYYY
  const mdySlash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mdySlash) {
    const m = mdySlash[1].padStart(2, '0');
    const d = mdySlash[2].padStart(2, '0');
    let y = mdySlash[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // MM-DD-YYYY
  const mdyDash = text.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (mdyDash) {
    const m = mdyDash[1].padStart(2, '0');
    const d = mdyDash[2].padStart(2, '0');
    let y = mdyDash[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // "Jan 15, 2025" or "January 15, 2025"
  const monthNames = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i;
  const monthMatch = text.match(monthNames);
  if (monthMatch) {
    const monthStr = monthMatch[0].slice(0, 3).toLowerCase();
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[monthStr] || '01';
    const d = monthMatch[1].padStart(2, '0');
    return `${monthMatch[2]}-${m}-${d}`;
  }

  return '';
};

const SnapReceiptOCR = ({ onExtracted }: Props) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setProgress(0);

    try {
      const dataUrl = await fixOrientation(file);

      const worker = await createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(dataUrl);
      await worker.terminate();

      const total = extractTotal(text);
      const date = extractDate(text);

      if (!total && !date) {
        toast.info('Could not extract data. Please fill in manually.');
      } else {
        const parts = [];
        if (total) parts.push(`Total: ₱${total}`);
        if (date) parts.push(`Date: ${date}`);
        toast.success(`Extracted: ${parts.join(', ')}`);
      }

      onExtracted({ total, date });
    } catch (err: any) {
      console.error('OCR error:', err);
      toast.error('Failed to process image');
    } finally {
      setProcessing(false);
      setProgress(0);
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={processing}
        onClick={() => cameraRef.current?.click()}
        className="font-display text-xs tracking-wider gap-1.5 w-full min-h-[44px] border-accent/40 hover:border-accent"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing {progress}%…
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            <ScanLine className="w-3.5 h-3.5" />
            Snap Receipt
          </>
        )}
      </Button>
      {processing && (
        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default SnapReceiptOCR;
