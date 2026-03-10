

## Plan: Remove Dashboard Button from Staff NavBar

### Problem
The StaffNavBar shows a "Dashboard" button to **all** staff who have access to any module — even view-only staff like Jessa (housekeeping). This is confusing because the Dashboard (`/admin`) is an admin/manager interface, not a staff tool. It disrupts the staff workflow.

### Change

**`src/components/StaffNavBar.tsx`**

Remove all Dashboard-related code:
1. Remove the `hasDashboardAccess` computation (lines 68-69)
2. Remove the `goDashboard` function
3. Remove the Dashboard `<Button>` from both desktop and mobile `NavItems`
4. Remove the `LayoutDashboard` icon import

The nav will keep: **Home**, **My Work**, **Service**, and **Logout** — which are the actual staff tools. Admins access the dashboard via `getHomeRoute()` which already routes them to `/admin`.

### Files
```
EDIT  src/components/StaffNavBar.tsx  (remove Dashboard button + related logic)
```

One file, surgical removal. No other files affected.

