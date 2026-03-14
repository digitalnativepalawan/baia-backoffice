

## Plan: Fix Orders Tab Not Reflecting Kitchen/Bar Status Changes in Real-Time

### Root Cause

When the Kitchen or Bar department view updates an order (e.g., marks it as "Preparing"), it only invalidates its own query cache key (`orders-kitchen` or `orders-bar`). The Orders tab in the admin page uses a separate query key (`orders-admin`). While all views have realtime subscriptions on the `orders` table, the realtime channel may not fire reliably across multiple simultaneous channels on the same table.

The result: kitchen marks an order as "Preparing" → kitchen view updates instantly → Orders tab still shows "New" until a manual refresh.

### Fix

**Cross-invalidate all order query keys** whenever any view updates an order, and add polling as a reliable fallback.

#### 1. `src/components/DepartmentOrdersView.tsx` — Cross-invalidate on status change

In `advanceDeptStatus`, after updating the order, also invalidate `orders-admin` and `orders-staff`:

```typescript
qc.invalidateQueries({ queryKey: [`orders-${department}`] });
qc.invalidateQueries({ queryKey: ['orders-admin'] });
qc.invalidateQueries({ queryKey: ['orders-staff'] });
```

#### 2. `src/pages/AdminPage.tsx` — Cross-invalidate + add polling

In `advanceOrder`, also invalidate kitchen/bar query keys:

```typescript
qc.invalidateQueries({ queryKey: ['orders-admin'] });
qc.invalidateQueries({ queryKey: ['orders-kitchen'] });
qc.invalidateQueries({ queryKey: ['orders-bar'] });
qc.invalidateQueries({ queryKey: ['orders-staff'] });
```

Add `refetchInterval: 5000` to the `orders-admin` query as a reliable polling fallback.

Also update the realtime handler to invalidate all order-related keys.

#### 3. `src/components/staff/StaffOrdersView.tsx` — Same cross-invalidation

In `advanceOrder`, also invalidate admin/kitchen/bar keys. Add `refetchInterval: 5000`.

### Files to edit

| File | Change |
|------|--------|
| `src/components/DepartmentOrdersView.tsx` | Add cross-invalidation of `orders-admin`, `orders-staff` in `advanceDeptStatus` |
| `src/pages/AdminPage.tsx` | Add cross-invalidation + `refetchInterval: 5000` on `orders-admin` query |
| `src/components/staff/StaffOrdersView.tsx` | Add cross-invalidation + `refetchInterval: 5000` on `orders-staff` query |

