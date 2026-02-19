

# Invoice Redesign: Uniform, Professional, Admin-Customizable

## Overview

Redesign the PDF invoice and on-screen invoice view to be clean, modern, and professional. Add a new `invoice_settings` database table so admins can customize the invoice appearance (footer text, business hours, TIN, thank-you message, service charge %, and display preferences). Update the PDF generator and TabInvoice component to pull from these settings.

## Database Change

### New table: `invoice_settings`

A single-row settings table (similar to the existing `settings` table pattern) with:

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| thank_you_message | text | 'Thank you for dining with us!' |
| business_hours | text | 'Open daily: 7AM - 10PM' |
| footer_text | text | '' |
| tin_number | text | '' |
| service_charge_pct | numeric | 10 |
| show_service_charge | boolean | true |
| show_payment_method | boolean | true |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: Public read/insert/update (matching existing pattern for settings tables).

## File Changes

### 1. `src/lib/generateInvoicePdf.ts` -- Full Redesign

**Header changes:**
- Remove `charSpace: 3` from resort name -- render as normal text with clean kerning
- Split layout: left side = business name + address + contact; right side = date, time, order type
- Use proper font weights: light labels, bold values
- Add thin horizontal rule divider below header

**Table improvements:**
- Clean column headers with subtle background
- Proper alignment: item left, qty center, price right, total right
- Alternating row tints (keep existing)

**Totals:**
- Pull service charge % from invoice_settings instead of hardcoding "10%"
- Grand total with accent background (keep existing)

**Footer (new):**
- Thin divider line
- Thank-you message from `invoice_settings`
- Business hours from `invoice_settings`
- Social media handles from `resort_profile` (Instagram, website)
- TIN number from `invoice_settings` (if set)
- Footer custom text from `invoice_settings` (if set)

**Function signature update:**
- Accept optional `invoiceSettings` parameter alongside `profile`

### 2. `src/components/admin/TabInvoice.tsx` -- On-Screen Invoice Redesign

**Header section:**
- Remove `tracking-[0.3em]` letter spacing from resort name
- Reorganize: left-align business details, right-align date/type
- Cleaner, more minimal card design

**Footer section (new):**
- Display thank-you message, business hours, social handles below grand total
- Pull from `invoice_settings` query

**Pass invoice settings to PDF generator** when downloading.

### 3. New component: `src/components/admin/InvoiceSettingsForm.tsx`

Admin form with fields for:
- Thank-you message (textarea)
- Business hours (text input)
- Additional footer text (textarea)
- TIN/VAT number (text input)
- Service charge % (number input)
- Toggle: show/hide service charge breakdown
- Toggle: show/hide payment method

Uses the same inline CRUD pattern as ResortProfileForm (single-row upsert).

### 4. `src/pages/AdminPage.tsx`

- Import and render `InvoiceSettingsForm` inside the Setup tab, after Kitchen Settings section
- Add section header "Invoice Settings"

### 5. New hook: `src/hooks/useInvoiceSettings.ts`

Simple react-query hook to fetch the single row from `invoice_settings`, similar to `useResortProfile`.

### 6. `buildInvoiceWhatsAppText` update

- Include footer info (business hours, website) in WhatsApp text
- Use dynamic service charge label

## Technical Notes

- The resort_profile already has logo_url, address, phone, email, website_url, social links -- these will continue to be used for the invoice header (no duplication)
- Invoice-specific settings (footer text, TIN, service charge %) go in the new `invoice_settings` table
- No changes to existing tables
- The `charSpace` removal fixes the "B A I A  P A L A W A N" spacing issue in the PDF

