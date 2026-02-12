

# Open Tab Invoice System

## The Problem
Currently, every order is a one-off transaction -- the cart clears after each submission. A guest staying 3 days has no way to accumulate charges on a running tab. There's also no proper invoice/receipt format, and the 10% service charge isn't calculated.

## How It Works

### Guest Tabs
A new `tabs` database table tracks open accounts tied to a location (e.g., "Unit 3" or "Table 1"). When a guest or staff places an order, the system checks if there's already an open tab for that location. If yes, the new order attaches to it. If not, a new tab is created automatically.

```text
Guest arrives at Unit 3
  --> First order creates Tab #001 for "Unit 3"
  --> Second order (next day) adds to the same tab
  --> Third order (day 3) adds again
  --> Staff closes tab at checkout --> Final invoice generated
```

### Checkout Flow Redesign
The CartDrawer becomes a proper invoice-style review:
- Resort header with "BAIA PALAWAN" branding
- Itemized list with quantities, unit prices, line totals
- Subtotal line
- 10% Service Charge line (auto-calculated)
- Grand Total
- Two action buttons:
  - **"Send to Kitchen"** -- places the order on the current tab, sends WhatsApp notification
  - **"Close and Pay"** is only available in Admin, not during ordering

### Admin Tab Management
A new **"Tabs"** section in the Admin Orders area lets staff:
- See all open tabs with guest name/location and running total
- Tap a tab to see every order on it (with timestamps)
- **Close Tab** button generates the final invoice summary and marks it as settled
- Payment method selection (Cash / Card / Charge to Room) at close-out time

---

## Database Changes

**New `tabs` table:**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| location_type | text | Room, DineIn, Beach, WalkIn |
| location_detail | text | e.g., "Unit 3", "Table 1" |
| guest_name | text (nullable) | Optional guest name |
| status | text | "Open" or "Closed" |
| payment_method | text (nullable) | Set when closing |
| created_at | timestamptz | Tab opened |
| closed_at | timestamptz (nullable) | Tab settled |

**Add to `orders` table:**
| Column | Type | Description |
|--------|------|-------------|
| tab_id | uuid (nullable, FK to tabs) | Links order to a tab |

Enable Realtime on `tabs` table.

---

## File Changes

| File | Change |
|------|--------|
| Migration SQL | Create `tabs` table, add `tab_id` column to `orders`, enable realtime |
| `src/components/CartDrawer.tsx` | Redesign as invoice-style layout with service charge calculation, auto-attach orders to open tabs |
| `src/pages/AdminPage.tsx` | Add "Tabs" sub-view in Orders tab showing open/closed tabs with close-out functionality |
| `src/components/admin/TabInvoice.tsx` | New component -- full invoice view for a tab showing all orders, subtotal, service charge, grand total |

---

## Technical Details

**Tab auto-detection logic (in CartDrawer):**
1. On "Send to Kitchen", query `tabs` for an open tab matching the current `location_detail` and `location_type`
2. If found, use that `tab_id` for the new order
3. If not found, insert a new tab row, then use its id
4. Order is inserted with the `tab_id` reference

**Invoice layout in CartDrawer:**
- Header: "BAIA PALAWAN -- Micro Resort"
- Order type and location displayed
- Itemized table: Item | Qty | Price | Total
- Subtotal
- Service Charge (10%): auto-calculated as `subtotal * 0.10`
- Grand Total: `subtotal + service_charge`
- "Send to Kitchen" button (places order, keeps tab open)

**Admin tab close-out:**
- Fetch all orders where `tab_id = selected_tab.id`
- Display combined invoice with all orders grouped by timestamp
- Select payment method, then update `tabs.status = 'Closed'` and `tabs.closed_at = now()`
- All orders on the tab get status set to "Paid" then "Closed" automatically

**Service charge stored on each order:**
- Add `service_charge` numeric column to `orders` table (default 0)
- Calculated as `total * 0.10` at order time
- Reports tab can sum both `total` and `service_charge` for accurate revenue

