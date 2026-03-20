

## Plan: Add "Mark Served" and "Charge to Room" Buttons to Reception Room Orders

### Problem
Reception sees room orders with status "Ready" but has no way to mark them as "Served." Without this transition, orders don't count as sales, don't appear in the Cashier pipeline, and don't flow into reports. Reception needs two actions:
1. **"Served · Charge to Room"** — marks order as Served and keeps it on the room folio for checkout settlement
2. **"Served · Send to Cashier"** — marks order as Served so it appears in the Cashier view for immediate payment

### Changes

**`src/pages/ReceptionPage.tsx`** — Reception Recent Room Orders section (lines ~1496-1511)

Add two new buttons alongside the existing "Mark Paid", "Comp", "Delete" actions, visible when `order.status === 'Ready'`:

1. **"Served · Room Charge"** button (primary green style):
   - Updates order status to `Served`, sets `payment_type: 'Charge to Room'`
   - Creates a `room_transaction` record linking the order total to the guest's unit folio (using `order.room_id` and `order.guest_name`)
   - Order stays on the guest's bill for checkout settlement
   - Invalidates relevant query caches

2. **"Served · Pay Now"** button (secondary outline style):
   - Updates order status to `Served` only (no payment_type set)
   - Order flows into the Cashier view for immediate cash/card settlement

Both buttons also appear when status is `New` or `Preparing` (for edge cases where reception needs to override), but primarily target `Ready` orders.

Keep existing "Mark Paid", "Comp", "Delete" buttons as-is for backward compatibility.

### Files changed
- `src/pages/ReceptionPage.tsx` (~20 lines added in the corrective actions section)

No changes to Kitchen, Bar, Cashier, or ServiceBoard.

