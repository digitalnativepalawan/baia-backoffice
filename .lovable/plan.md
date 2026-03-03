
# Add Route-Level Permission Enforcement

## Problem
The Index page tiles are properly hidden based on permissions, but the routes themselves only check "is logged in" via `RequireAuth`. Susan (or any employee with no permissions) can still:
- Type `/kitchen` in the browser and access Kitchen Display
- Type `/order-type` and make orders
- Type `/housekeeper` and do housekeeping
- Type `/manager` and potentially see Rooms/check-in

## Solution

### 1. Upgrade `RequireAuth` to accept a `requiredPermission` prop

**File: `src/components/RequireAuth.tsx`**

Add an optional `requiredPermission` prop. When provided, the component reads the session's `permissions` array and checks `hasAccess()`. If the user lacks the required permission (and is not admin), redirect to `/` with a toast message.

```text
interface RequireAuthProps {
  children: ReactNode;
  requiredPermission?: string;  // e.g. 'kitchen', 'bar', 'orders', 'housekeeping'
  adminOnly?: boolean;          // for /admin route
}
```

Logic:
- If no session: redirect to `/` (existing behavior)
- If `adminOnly` and not admin: redirect to `/`
- If `requiredPermission` and not admin and no access: redirect to `/`
- Otherwise: render children

### 2. Update routes in `App.tsx`

**File: `src/App.tsx`**

Apply permission requirements to each protected route:

| Route | RequiredPermission |
|-------|-------------------|
| `/order-type` | `orders` |
| `/kitchen` | `kitchen` |
| `/bar` | `bar` |
| `/housekeeper` | `housekeeping` |
| `/admin` | `adminOnly` |
| `/manager` | (any permission -- keep current behavior) |
| `/employee` | (none -- all staff) |

### 3. No database changes needed

The permission system already works via `employee_permissions` table with string keys and the `hasAccess()` helper. This change just enforces those same checks at the route level.

## Files to Change

| File | Change |
|------|--------|
| `src/components/RequireAuth.tsx` | Add `requiredPermission` and `adminOnly` props with permission checking logic |
| `src/App.tsx` | Pass permission props to each `RequireAuth` wrapper |
