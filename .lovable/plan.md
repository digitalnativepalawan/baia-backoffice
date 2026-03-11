

## Add Resort Logo to Printed Receipts & PDF Invoices

### How it works
The logo is already stored in the `resort_profile` table as `logo_url` (a public URL from storage). It's a PNG/SVG with a transparent background per the upload guidance. For print receipts (white background), the logo renders naturally. For the on-screen receipt preview (dark background), the logo already has transparency so it blends.

### Approach
Inject the logo as an `<img>` tag at the top of every printed HTML receipt, and as an image in the jsPDF invoice — all pulled from `profile.logo_url`. Size controlled by `profile.logo_size` (default ~64px for receipts).

### Changes

| File | What |
|------|------|
| `src/components/service/CashierReceipt.tsx` | Add logo `<img>` to the print HTML (line ~83) and to the on-screen preview. Use `profile?.logo_url` |
| `src/components/rooms/PrintBill.tsx` | Add logo `<img>` at top of the printed HTML header |
| `src/lib/generateInvoicePdf.ts` | Fetch logo as base64, embed at top of PDF using `doc.addImage()` before the resort name |
| `src/components/admin/TabInvoice.tsx` | Already shows logo in preview — no change needed |

### Detail: PDF logo embedding
jsPDF requires base64 or a loaded image. We'll fetch the logo URL, convert to base64 via canvas, then call `doc.addImage(base64, 'PNG', x, y, width, height)`. If the logo fails to load, gracefully skip it and just show the text header.

```text
┌─────────────────────┐
│      [LOGO]         │  ← logo from resort_profile.logo_url
│    BAIA Palawan     │
│   "your tagline"    │
│   ─────────────     │
│   RECEIPT / BILL    │
│   ...items...       │
└─────────────────────┘
```

### Background matching
- **Print receipts** (thermal/paper): White background — transparent PNG logo works perfectly
- **On-screen preview**: Dark card background — transparent PNG renders on dark naturally
- **PDF invoice**: White page — same transparent PNG works
- No special background color manipulation needed as long as the logo has transparency (which the upload form already recommends)

