

## Cashier & Bill Out — Fast Walk-in Payment Flow

### Overview
Add a dedicated **Cashier** station to Service Mode that combines live kitchen/bar order visibility with a fast payment checkout flow. Also add a **"Bill Out"** column to the Reception service board for orders awaiting payment.

### 1. "Bill Out" Column in Reception Service Board

**File: `src/components/service/ServiceBoard.tsx`**

- Add `'Bill Out'` to `KANBAN_COLS` array (after `Ready`): `['New', 'Preparing', 'Ready', 'Bill Out']`
- Add color: `'Bill Out': 'border-t-amber-400'`
- In the column bucketing logic, route `Served` non-auto-payable orders into `Bill Out` instead of keeping them in `Ready` (this is the walk-in/dine-in orders awaiting payment)
- Update mobile tabs to include "Bill Out"

### 2. Cashier Page & Route

**New file: `src/pages/ServiceCashierPage.tsx`**
- Similar to `ServiceReceptionPage` but uses `department="cashier"`

**New file: `src/components/service/CashierBoard.tsx`**
- Full-screen layout with two sections:
  - **Left/Top: Live Orders** — Shows all today's active orders (from kitchen & bar) in a compact list with status dots, similar to reception board but focused on ready/served orders
  - **Right/Bottom: Bill Out Panel** — When an order is tapped, opens inline bill view with:
    - Itemized order summary (items, subtotal, service charge, total)
    - **Payment method selector** (tile buttons from `payment_methods` table, excluding "Charge to Room")
    - **"Charge to Room Tab"** button — links the order to a guest's room booking (shows room selector dropdown from active bookings)
    - **"Confirm Payment"** button — marks order as Paid, records payment method, shows printable receipt
    - After payment confirmed: receipt appears on screen with "Print" button, then auto-moves to completed

**Flow:**
1. Cashier sees orders in New → Preparing → Ready → Bill Out columns
2. Guest approaches to pay → Cashier taps the order card
3. Bill detail opens with total displayed prominently
4. Cashier selects payment method (Cash, Card, GCash, etc.) — this is the ONLY place payment method is chosen
5. Clicks "Confirm Payment" → order marked Paid, `closed_at` set, `payment_type` recorded
6. Receipt renders on screen (thermal-style HTML), can be printed
7. Order moves to Completed section

### 3. "Charge to Room Tab" Option

Within the cashier bill-out panel, add a "Charge to Room" option that:
- Fetches active bookings from `resort_ops_bookings` (checked-in, today)
- Shows room/unit tiles for quick selection
- When selected, updates the order's `room_id`, `payment_type = 'Charge to Room'`, and creates a `room_transaction` entry
- Auto-marks as Paid since it's now a room charge

### 4. Service Mode Hub Update

**File: `src/pages/ServiceModePage.tsx`**
- Add a new Cashier department card with `Banknote` icon and route `/service/cashier`
- Count: orders in Served status (non-auto-payable) = awaiting payment

### 5. Route Registration

**File: `src/App.tsx`**
- Add route: `/service/cashier` → `ServiceCashierPage` with `RequireAuth requiredPermission={['reception', 'orders']}`

### 6. Receipt Display Component

**New file: `src/components/service/CashierReceipt.tsx`**
- Thermal-style receipt displayed on screen after payment
- Uses resort profile, invoice settings, billing config (same data as PrintBill)
- "Print" button opens in new window for thermal printer
- "Done" button dismisses and returns to order list

### Files Summary

| File | Action |
|------|--------|
| `src/components/service/ServiceBoard.tsx` | Add "Bill Out" column for reception dept |
| `src/components/service/CashierBoard.tsx` | New — full cashier board with payment flow |
| `src/components/service/CashierReceipt.tsx` | New — on-screen receipt after payment |
| `src/pages/ServiceCashierPage.tsx` | New — page wrapper |
| `src/pages/ServiceModePage.tsx` | Add Cashier button to hub |
| `src/App.tsx` | Add `/service/cashier` route |

No changes to existing business logic, order creation, or menu systems.

