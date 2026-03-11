

## Fix: Walk-in Orders Not Appearing in Cashier Bill Out

### The Problem
When kitchen marks a walk-in order as "Ready", it does NOT appear in the Cashier's "Bill Out" section. The cashier only sees orders with status `Served`, but walk-in orders sit at `Ready` waiting for someone to click "Mark Served" first — which nobody does because the cashier is supposed to handle it.

The French toast order likely got auto-routed to Completed through this gap.

### The Fix

**File: `src/components/service/CashierBoard.tsx`**

1. **Show "Ready" orders in Bill Out section** — Change the bucketing logic so non-auto-payable (walk-in, dine-in) orders with status `Ready` appear in the "Bill Out" bucket alongside `Served` orders. This gives the cashier visibility of orders that are ready for collection and payment.

2. **Add "Serve & Pay" action** — When the cashier selects a `Ready` order and confirms payment, the system transitions it directly from `Ready` → `Paid` (setting `status`, `payment_type`, and `closed_at` in one update). No intermediate "Mark Served" step needed.

3. **Update the Bill Out panel** — The BillOutPanel should handle both `Ready` and `Served` orders. For `Ready` orders, the confirm button label changes to "Serve & Confirm Payment" to make it clear.

4. **Realtime invalidation** — Also invalidate `cashier-completed` on realtime changes so completed orders appear immediately without waiting for the 10s poll.

### Bucketing Logic Change
```text
Current:
  Served (non-auto-payable) → Bill Out
  Ready                     → Active (hidden from billing)

Fixed:
  Served (non-auto-payable) → Bill Out
  Ready  (non-auto-payable) → Bill Out  ← NEW
  Ready  (auto-payable)     → Active    (room charges still need "Serve & Close")
```

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/service/CashierBoard.tsx` | Update bucket logic to put Ready walk-in/dine-in orders into billOut; update handleConfirmPayment to handle Ready→Paid transition; invalidate completed query on realtime |

