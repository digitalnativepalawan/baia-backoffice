

## Enhanced Receipt OCR with Image Preprocessing

### Overview
Upgrade the existing `SnapReceiptOCR` component to include image preprocessing (grayscale, contrast, thresholding) for better OCR accuracy, extract additional fields (vendor, VAT, TIN), and autofill all expense form fields. A feature flag controls the entire feature. No database, routing, or external module changes.

### Changes

**Modified file: `src/components/admin/SnapReceiptOCR.tsx`**

Complete rewrite of the existing component:

1. **Image Preprocessing Pipeline** (new `preprocessImage` function):
   - Load image onto a canvas
   - Convert to grayscale using luminance formula (0.299R + 0.587G + 0.114B)
   - Apply contrast enhancement (factor 1.5)
   - Apply binary thresholding (threshold ~128) to produce clean black/white image
   - Output as data URL for Tesseract

2. **Expanded Extraction Types** -- the `ExtractedFields` type grows to include:
   - `total` (string) -- largest currency value found
   - `date` (string) -- detected date in YYYY-MM-DD format
   - `vendor` (string) -- first prominent uppercase text line
   - `vatAmount` (string) -- numeric value near "VAT" keyword
   - `tin` (string) -- TIN pattern (###-###-### or 9-12 digit string)
   - `vatDetected` (boolean) -- whether VAT was found at all

3. **New Extraction Functions**:
   - `extractTotal`: Enhanced to find the largest currency value (₱, PHP, $) or fallback to largest decimal number
   - `extractDate`: Already handles MM/DD/YYYY, add YYYY-MM-DD and DD/MM/YYYY support
   - `extractVendor`: Takes first line that is mostly uppercase and > 3 chars, skipping common receipt headers like "OFFICIAL RECEIPT"
   - `extractVAT`: Looks for lines containing "VAT" and extracts nearby numeric value
   - `extractTIN`: Matches patterns like `###-###-###`, `###-###-###-###`, or 9-12 consecutive digits

4. **UI**: Keep existing button style; add a secondary "Upload File" option alongside the camera capture button. Both feed into the same processing pipeline.

5. **Feature Flag**: A `receipt_auto_extract_enabled` constant at the top of the file. When `false`, the component renders nothing.

**Modified file: `src/components/admin/ExpensesDashboard.tsx`**

Update the `onExtracted` callback (lines 447-453) to handle all new fields:

```
onExtracted={({ total, date, vendor, vatAmount, tin, vatDetected }) => {
  setForm(f => ({
    ...f,
    amount: total || f.amount,
    expense_date: date || f.expense_date,
    vendor: vendor || f.vendor,
    tax_amount: vatAmount || f.tax_amount,
    tin: tin || f.tin,
    vat_type: vatDetected ? 'vatable' : f.vat_type,
  }));
}}
```

No other files are touched. No database changes. No changes to routing, navigation, or other modules.

### Extraction Logic Details

**Amount** (select largest value):
1. Find all currency-prefixed values (₱, PHP, $)
2. Find all "total/amount/due" labeled values
3. Fallback: find all numbers with exactly 2 decimal places
4. Return the largest value found across all matches

**Date** (first match wins):
- `YYYY-MM-DD` format
- `MM/DD/YYYY` or `MM/DD/YY` format
- `DD/MM/YYYY` format (checked if first number > 12)
- Month name formats ("Jan 15, 2025")

**Vendor**:
- Split OCR text into lines
- Find first line that is mostly uppercase letters (>60% uppercase), longer than 3 chars
- Skip common noise words: "OFFICIAL RECEIPT", "SALES INVOICE", "RECEIPT", date-only lines

**VAT**:
- Search for lines containing "VAT" (case-insensitive)
- Extract the first numeric value on that line or the next line
- If found, set `vatDetected = true`

**TIN**:
- Match `\d{3}-\d{3}-\d{3}` or `\d{3}-\d{3}-\d{3}-\d{3}` patterns
- Fallback: match standalone 9-12 digit sequences near "TIN" keyword

### Performance
- Image preprocessing runs synchronously on canvas (fast, ~50ms)
- Tesseract worker runs in a Web Worker (non-blocking)
- Progress bar shows real-time OCR progress percentage
- Toast notifications summarize what was extracted
- If nothing is extracted, a friendly message tells the user to fill manually

