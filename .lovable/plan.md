

## Fix Inventory Deduction — Double-Deduction & Race Condition Bugs

### Problems Found

1. **Double deduction for "both" department items**: In `ServiceBoard.tsx`, when an order has items with `department: 'both'`, the `kitchen-start` action filters items where `d === 'kitchen' || d === 'both'` and deducts. Then `bar-start` filters `d === 'bar' || d === 'both'` and deducts again. Result: ingredients for "both" items are deducted **twice**.

2. **No duplicate prevention**: If someone clicks "Start Preparing" twice quickly, or the page refreshes and the action replays, the same order's ingredients get deducted again. There's no check for "was this order already deducted?"

3. **Race condition on stock update**: The function reads `current_stock`, calculates `newStock = current_stock - deduction`, then writes it. Two concurrent deductions could both read the same value and overwrite each other. Should use an atomic SQL decrement.

4. **StaffOrdersView deducts ALL items** on "Preparing" without department filtering — different approach from ServiceBoard but also risks double-counting if the order passes through both flows.

### Solution

**1. `src/lib/inventoryDeduction.ts` — Add duplicate guard + atomic decrement**

- Before deducting, check if `inventory_logs` already has entries with `reason = 'order_deduction'` and the same `order_id` + `ingredient_id` combo. Skip if already deducted.
- For "both" department items: accept an optional `forDepartment` parameter. When provided, only deduct ingredients that belong to that department. This prevents kitchen-start and bar-start from both deducting the same ingredient.
- Use Supabase RPC or a raw SQL `current_stock = current_stock - X` pattern to make the decrement atomic (avoid read-then-write race).

**2. `src/components/service/ServiceBoard.tsx` — Pass department context**

- On `kitchen-start`: call `deductInventoryForOrder(orderId, items, 'kitchen')`
- On `bar-start`: call `deductInventoryForOrder(orderId, items, 'bar')`
- The deduction function uses this to avoid double-deducting shared ingredients

**3. Create a DB function for atomic stock decrement**

- Migration: `CREATE FUNCTION decrement_stock(ingredient_id uuid, amount numeric)` that does `UPDATE ingredients SET current_stock = GREATEST(0, current_stock - amount) WHERE id = ingredient_id`
- This eliminates the race condition entirely

**4. `src/components/staff/StaffOrdersView.tsx` — Add duplicate guard**

- The `advanceOrder` function already calls `deductInventoryForOrder` on "Preparing". The duplicate guard in the deduction function will protect this path too.

### File Summary

```
EDIT: src/lib/inventoryDeduction.ts           — duplicate guard, atomic decrement via RPC, department-aware deduction
EDIT: src/components/service/ServiceBoard.tsx  — pass department to deduction calls
EDIT: src/components/staff/StaffOrdersView.tsx — no changes needed (protected by duplicate guard)
MIGRATION: CREATE FUNCTION decrement_stock     — atomic stock update
```

