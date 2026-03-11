

## Fix Payment Flow, Room Charge Display & Checkout Bug

### Issues Identified

1. **Room charge orders incorrectly show as "Paid"** in cashier/service boards — they should be labeled "Charged to Room" and separated from register-settled orders
2. **Payment type selector shown to waitress** during order placement — should be removed; only the cashier chooses payment method
3. **Reservation checkout bug** — the `mark-served` action auto-sets Room orders to `Paid` status, which may trigger downstream effects

### Changes

#### 1. Remove Payment Type Selection from Order Flow
**File: `src/components/CartDrawer.tsx`**
- Remove the entire "Payment Type" selector block (lines 567-587) for staff orders
- Keep the automatic `Charge to Room` assignment for Room-linked orders and guest self-service (this triggers room_transaction creation)
- For non-room staff orders, `payment_type` stays empty — cashier will set it later
- Update the validation at line 188-192 to no longer require payment type for any staff order type

#### 2. Distinguish "Charged to Room" from "Paid" in Service Boards
**File: `src/components/service/ServiceBoard.tsx`**
- In the column bucketing (lines 119-141), keep auto-completing Room Charge orders to Completed section but display them with a "Charged to Room" badge instead of "Paid"

**File: `src/components/service/CashierBoard.tsx`**
- In `isAutoPayable` (line 83), keep the logic so Room/Tab orders auto-complete
- In `OrderRow` component (line 304), show "Room Charge" badge instead of generic status for `payment_type === 'Charge to Room'`
- In `DailySummary`, visually separate room charges from register payments — show register payments as the primary reconciliation figure, room charges as a secondary info line

#### 3. Show "Pending Payment" for Unsettled Orders
**File: `src/components/service/CashierBoard.tsx`**
- Orders without `payment_type` (empty string) display "Pending Payment" badge in amber
- These are the walk-in/dine-in orders awaiting cashier settlement

**File: `src/components/service/ServiceBoard.tsx`**
- Same "Pending Payment" label for orders in Bill Out column

#### 4. Fix Mark-Served Auto-Pay Logic
**File: `src/components/service/ServiceBoard.tsx` (line 194-200)**
**File: `src/components/service/CashierBoard.tsx` (line 171-177)**
- When marking served: only auto-complete to `Paid` if `payment_type === 'Charge to Room'` AND the order has a valid `room_id` (prevents false positives from legacy data)
- Tab orders (`tab_id`) still auto-complete as before

#### 5. Investigate Checkout Bug
The reservation auto-checkout issue (Wesley's room) is likely caused by the `mark-served` action auto-setting status to `Paid` + `closed_at`, which may interact with the checkout flow. By tightening the auto-pay conditions above, this should be prevented. No separate schema change needed — it's a consequence of the same payment flow issue.

### Files Modified

| File | Change |
|------|--------|
| `src/components/CartDrawer.tsx` | Remove payment type selector for staff, keep auto Charge-to-Room for room orders |
| `src/components/service/ServiceBoard.tsx` | Show "Pending Payment" / "Room Charge" badges, tighten auto-pay |
| `src/components/service/CashierBoard.tsx` | Same badge updates, separate room charges in daily summary |

