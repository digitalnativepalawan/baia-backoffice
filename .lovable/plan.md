

## Plan: Enforce Permission-Based Action Buttons Across the App

### Problem
Staff members like Jessa can see and use order pipeline buttons ("Start Preparing", "Mark Served", "Mark Paid") even when they only have view-level access to orders or limited department access. The permission checks are inconsistent across components.

### Root Cause
The `canPipeline` check in `StaffOrdersView` (line 23) is too broad:
```
canPipeline = isAdmin || canManage(perms, 'orders') || canEdit(perms, 'kitchen') || canEdit(perms, 'bar')
```
This means anyone with `kitchen:edit` or `bar:edit` can advance orders through the **full** pipeline (New → Preparing → Served → Paid → Closed), not just their department status. Staff with `orders:view` should see orders but not have action buttons.

### Changes

**1. `src/components/staff/StaffOrdersView.tsx`**
- Tighten `canPipeline` to only allow users with `orders:edit` or `orders:manage` (or admin) to advance the full order pipeline
- Remove `canEdit(perms, 'kitchen') || canEdit(perms, 'bar')` from `canPipeline` — those staff use the department-specific views (Kitchen/Bar tabs) which already have proper `canAct` checks
- Result: Orders tab becomes a read-only order feed for view-only staff

**2. `src/components/admin/OrderCard.tsx`**
- No changes needed — it already conditionally renders buttons based on whether `onAdvance` is passed. The fix upstream (not passing `onAdvance`) handles it.

**3. `src/pages/AdminPage.tsx`** — Already correct (uses `readOnly('orders')`)

**4. `src/pages/ManagerPage.tsx`** — Already correct (uses `readOnly('orders')`)

**5. `src/components/DepartmentOrdersView.tsx`** — Already correct (uses `canAct` with department-specific permission)

**6. `src/components/service/ServiceOrderCard.tsx`** — Already correct (checks `canEdit(permissions, 'kitchen')` etc.)

**7. `src/components/service/ServiceOrderDetail.tsx`** — Already correct (checks `canEdit(permissions, ...)`)

### Summary
Only one file needs changing: `StaffOrdersView.tsx`. The `canPipeline` variable needs to check `canEdit(perms, 'orders')` instead of kitchen/bar edit permissions. Kitchen and bar staff already have their own department-specific views with proper scoped controls.

### Files
```
EDIT  src/components/staff/StaffOrdersView.tsx  — Fix canPipeline to require orders:edit/manage permission
```

