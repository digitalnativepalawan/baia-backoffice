import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, ScanLine, Upload } from 'lucide-react';
import { toast } from 'sonner';

/* ── Feature flag ── */
const receipt_auto_extract_enabled = true;

/* ── Types ── */
type ExtractedFields = {
  total: string;
  date: string;
  vendor: string;
  vatAmount: string;
  tin: string;
  vatDetected: boolean;
  vatType: string;
};

type Props = {
  onExtracted: (fields: ExtractedFields) => void;
};

/* ── Image preprocessing: grayscale → contrast → threshold ── */
const preprocessImage = (file: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const contrastFactor = 1.5;

      for (let i = 0; i < d.length; i += 4) {
        let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray = ((gray - 128) * contrastFactor) + 128;
        gray = Math.max(0, Math.min(255, gray));
        gray = gray > 128 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = gray;
      }

      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = url;
  });
};

/* ── Position-aware line parsing ── */
type DocLine = { text: string; index: number; position: number /* 0-1 */ };

const parseLines = (text: string): DocLine[] => {
  const raw = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const total = raw.length || 1;
  return raw.map((text, index) => ({ text, index, position: index / total }));
};

/* ── VENDOR EXTRACTION (scored heuristic) ── */
const VENDOR_NEGATIVE = /\b(TIN|PROP|PROPRIETOR|NON\s*VAT|VAT|RECEIPT\s*NO|SALES\s*INVOICE|OFFICIAL\s*RECEIPT|DATE\s*ISSUED|ACCREDITATION|BIR|PERMIT|PTU|AUTHORITY|PRINTER|MIN\s*NO|S\/N|CASHIER)\b/i;
const VENDOR_KEYWORDS = /\b(TRADING|ENTERPRISES|STORE|SERVICES|SUPPLY|MART|CORPORATION|CORP|INC|LLC|CO|COMPANY|RESTAURANT|EATERY|CAFE|SHOP|CENTER|HARDWARE|PHARMACY|DRUG|SUPERMARKET)\b/i;
const FOOTER_KEYWORDS = /\b(Date\s*Issued|Printer|Accreditation|BIR\s*Authority|PTU\s*No|THIS\s*SERVES|THANK\s*YOU|S\/N)\b/i;

const extractVendor = (lines: DocLine[]): string => {
  let best = '';
  let bestScore = -Infinity;

  for (const line of lines) {
    const t = line.text;
    if (t.length < 4) continue;

    let score = 0;

    // Position: top 25% gets +3
    if (line.position <= 0.25) score += 3;
    else if (line.position <= 0.5) score += 1;

    // ALL CAPS check
    const letters = t.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 3) {
      const upperCount = (t.match(/[A-Z]/g) || []).length;
      if (upperCount / letters.length > 0.7) score += 2;
    }

    // Business keywords
    if (VENDOR_KEYWORDS.test(t)) score += 2;

    // Negative signals
    if (VENDOR_NEGATIVE.test(t)) score -= 3;

    // Footer area (bottom 25%)
    if (line.position > 0.75) score -= 5;
    if (FOOTER_KEYWORDS.test(t)) score -= 5;

    // Skip lines that are pure numbers/dates
    if (/^\d[\d\/\-\.\s,:]+$/.test(t)) continue;
    // Skip very short after stripping
    if (letters.length < 3) continue;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return bestScore >= 0 ? best : '';
};

/* ── DATE EXTRACTION (context-aware priority) ── */
const DATE_PATTERNS = [
  /(\d{4})-(\d{1,2})-(\d{1,2})/,
  /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
  /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i,
];

const FOOTER_DATE_CONTEXT = /\b(date\s*issued|printer|accreditation|bir\s*authority|ptu)/i;

const parseMatchedDate = (match: RegExpMatchArray, patternIndex: number): string | null => {
  if (patternIndex === 3) {
    // Month name format
    const monthStr = match[0].slice(0, 3).toLowerCase();
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[monthStr];
    if (!m) return null;
    return `${match[2]}-${m}-${match[1].padStart(2, '0')}`;
  }

  if (patternIndex === 0) {
    // YYYY-MM-DD
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  // MM/DD/YYYY or MM-DD-YYYY
  let first = parseInt(match[1]);
  let second = parseInt(match[2]);
  let y = match[3];
  if (y.length === 2) y = `20${y}`;
  if (parseInt(y) < 2000 || parseInt(y) > 2099) return null;

  if (first > 12) {
    return `${y}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
  }
  return `${y}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
};

const extractDate = (lines: DocLine[]): string => {
  type DateCandidate = { date: string; priority: number };
  const candidates: DateCandidate[] = [];

  for (const line of lines) {
    // Skip footer context
    if (FOOTER_DATE_CONTEXT.test(line.text)) continue;
    if (line.position > 0.75 && FOOTER_KEYWORDS.test(line.text)) continue;

    for (let pi = 0; pi < DATE_PATTERNS.length; pi++) {
      const match = line.text.match(DATE_PATTERNS[pi]);
      if (!match) continue;

      const parsed = parseMatchedDate(match, pi);
      if (!parsed) continue;

      let priority = 0;
      // Near "Date:" label in upper half
      if (/date\s*[:]/i.test(line.text) && line.position <= 0.5) priority = 10;
      // Top 40%
      else if (line.position <= 0.4) priority = 5;
      // Upper half
      else if (line.position <= 0.5) priority = 3;
      // Bottom half but not footer
      else if (line.position <= 0.75) priority = 1;
      else priority = -5; // footer area

      candidates.push({ date: parsed, priority });
    }
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0].date;
};

/* ── AMOUNT EXTRACTION (deterministic, contextual) ── */
const AMOUNT_NOISE = /\b(TIN|RECEIPT\s*NO|ACCREDITATION|S\/N|MIN|OR\s*NO|SI\s*NO|PTU)\b/i;

const extractTotal = (lines: DocLine[]): string => {
  const parseNum = (s: string): number => {
    const cleaned = s.replace(/,/g, '');
    const v = parseFloat(cleaned);
    return isNaN(v) || v <= 0 ? 0 : v;
  };

  type AmtCandidate = { value: number; priority: number };
  const candidates: AmtCandidate[] = [];

  for (const line of lines) {
    const t = line.text;
    // Skip lines with noise keywords
    if (AMOUNT_NOISE.test(t)) continue;

    // Check for labeled total
    const isLabeled = /\b(total\s*(amount\s*due|sales|due)?|grand\s*total|amount\s*due|balance\s*due|net\s*amount)\b/i.test(t);

    // Extract all numeric values from this line
    const nums = [...t.matchAll(/[₱$P]?\s*([\d,]+\.\d{2})\b/g)];
    for (const m of nums) {
      const val = parseNum(m[1]);
      if (val <= 0) continue;

      let priority = 0;
      if (isLabeled) priority += 10;
      if (line.position >= 0.6) priority += 3; // bottom 40%
      if (/[₱$]/.test(m[0])) priority += 1;

      candidates.push({ value: val, priority });
    }

    // Also try bare numbers with 2 decimals if no currency symbol
    if (nums.length === 0) {
      const bare = [...t.matchAll(/([\d,]+\.\d{2})\b/g)];
      for (const m of bare) {
        const val = parseNum(m[1]);
        if (val <= 0) continue;
        let priority = 0;
        if (isLabeled) priority += 10;
        if (line.position >= 0.6) priority += 2;
        candidates.push({ value: val, priority });
      }
    }
  }

  if (candidates.length === 0) return '';

  // Sort by priority desc, then value desc
  candidates.sort((a, b) => b.priority - a.priority || b.value - a.value);
  return candidates[0].value.toFixed(2);
};

/* ── VAT TYPE AUTO-DETECTION (strict rule order) ── */
const detectVatType = (text: string): string => {
  // Rule 1: NON VAT variants → VAT Exempt
  if (/\b(non[\s\-]*vat|non[\s\-]*vat\s*reg)/i.test(text)) return 'VAT Exempt';
  // Rule 2: Zero Rated
  if (/\b(zero\s*rated|0%\s*vat)\b/i.test(text)) return 'Zero Rated';
  // Rule 3: VAT 12% or VAT line with decimal amount
  if (/vat\s*12%/i.test(text)) return 'Vatable';
  // Check for VAT line with an actual decimal amount (not just "VAT" keyword)
  const vatLines = text.split('\n').filter(l => /\bvat\b/i.test(l));
  for (const vl of vatLines) {
    if (/\bNON[\s\-]*VAT\b/i.test(vl)) continue; // skip NON VAT lines
    if (/[\d,]+\.\d{2}/.test(vl)) return 'Vatable';
  }
  // Rule 4: nothing found
  return '';
};

/* ── TAX AMOUNT EXTRACTION (safe guard) ── */
const extractTaxAmount = (lines: DocLine[]): { vatAmount: string; vatDetected: boolean } => {
  for (const line of lines) {
    const t = line.text;
    if (!/\bvat\b/i.test(t)) continue;
    // Skip NON VAT lines
    if (/\bnon[\s\-]*vat\b/i.test(t)) continue;
    // Skip lines with TIN, accreditation, receipt numbers
    if (AMOUNT_NOISE.test(t)) continue;

    // Look for decimal value on this line
    const numMatch = t.match(/([\d,]+\.\d{2})\b/);
    if (numMatch) {
      const val = parseFloat(numMatch[1].replace(/,/g, ''));
      if (val > 0 && val < 1000000) {
        return { vatAmount: val.toFixed(2), vatDetected: true };
      }
    }

    // Check next line
    const nextLine = lines.find(l => l.index === line.index + 1);
    if (nextLine && !AMOUNT_NOISE.test(nextLine.text)) {
      const nextMatch = nextLine.text.match(/([\d,]+\.\d{2})\b/);
      if (nextMatch) {
        const val = parseFloat(nextMatch[1].replace(/,/g, ''));
        if (val > 0 && val < 1000000) {
          return { vatAmount: val.toFixed(2), vatDetected: true };
        }
      }
    }

    return { vatAmount: '', vatDetected: true };
  }
  return { vatAmount: '', vatDetected: false };
};

/* ── TIN EXTRACTION (prefer top section, ignore noise) ── */
const extractTIN = (lines: DocLine[]): string => {
  // First pass: look for TIN-labeled lines in top 50%
  for (const line of lines) {
    if (line.position > 0.6) continue;
    if (!/\bTIN\b/i.test(line.text)) continue;
    // Skip printer/accreditation TINs
    if (FOOTER_KEYWORDS.test(line.text)) continue;

    const dashMatch = line.text.match(/\d{3}-\d{3}-\d{3}(-\d{3,5})?/);
    if (dashMatch) return dashMatch[0];

    const digitMatch = line.text.match(/\b(\d{9,14})\b/);
    if (digitMatch) return digitMatch[1];
  }

  // Second pass: any TIN pattern in top 50%
  for (const line of lines) {
    if (line.position > 0.5) continue;
    if (FOOTER_KEYWORDS.test(line.text)) continue;

    const dashMatch = line.text.match(/\d{3}-\d{3}-\d{3}(-\d{3,5})?/);
    if (dashMatch && !/\b(receipt|accreditation|s\/n|min)\b/i.test(line.text)) {
      return dashMatch[0];
    }
  }

  return '';
};

/* ── Component ── */
const SnapReceiptOCR = ({ onExtracted }: Props) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!receipt_auto_extract_enabled) return null;

  const processFile = async (file: File) => {
    setProcessing(true);
    setProgress(0);

    try {
      const dataUrl = await preprocessImage(file);

      const worker = await createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(dataUrl);
      await worker.terminate();

      const lines = parseLines(text);
      const total = extractTotal(lines);
      const date = extractDate(lines);
      const vendor = extractVendor(lines);
      const vatType = detectVatType(text);
      const { vatAmount, vatDetected } = extractTaxAmount(lines);
      const tin = extractTIN(lines);

      if (!total && !date && !vendor) {
        toast.info('Could not extract data. Please fill in manually.');
      } else {
        const parts: string[] = [];
        if (vendor) parts.push(`Vendor: ${vendor}`);
        if (total) parts.push(`Total: ₱${total}`);
        if (date) parts.push(`Date: ${date}`);
        if (vatType) parts.push(`VAT: ${vatType}`);
        if (vatAmount) parts.push(`Tax: ₱${vatAmount}`);
        if (tin) parts.push(`TIN: ${tin}`);
        toast.success(`Extracted: ${parts.join(', ')}`);
      }

      onExtracted({ total, date, vendor, vatAmount, tin, vatDetected, vatType });
    } catch (err: any) {
      console.error('OCR error:', err);
      toast.error('Failed to process image');
    } finally {
      setProcessing(false);
      setProgress(0);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-1.5">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleInput} />

      <Button
        type="button" variant="outline" size="sm" disabled={processing}
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

      {!processing && (
        <Button
          type="button" variant="ghost" size="sm" disabled={processing}
          onClick={() => fileRef.current?.click()}
          className="font-display text-xs tracking-wider gap-1.5 w-full min-h-[36px] text-muted-foreground"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload File
        </Button>
      )}

      {processing && (
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
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
