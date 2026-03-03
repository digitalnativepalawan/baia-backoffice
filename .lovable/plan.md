

# Fix: Stop View-Only Employees from Accessing Manager Dashboard

## Problem
Susan has `rooms:view`, `housekeeping:view`, `schedules:view`, `tasks:view` — all view-only. But the Employee Portal shows a "Dashboard" button because the condition is simply `empPermissions.length > 0`. Clicking it navigates Susan to `/manager`, which feels wrong and confusing even though mutation buttons are hidden.

The schedule and task views Susan needs are already available as tabs within the Employee Portal itself. She should never be sent to the manager dashboard.

## Root Cause
In `src/pages/EmployeePortal.tsx` line 277:
```
if (empPermissions.length > 0) {
  tabs.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
}
```
This shows Dashboard for ANY employee with ANY permission, including view-only ones.

## Solution

### 1. Only show Dashboard tab for employees with edit-level permissions
**File: `src/pages/EmployeePortal.tsx`**

Change the Dashboard tab condition from `empPermissions.length > 0` to check if the employee has at least one **edit-level** permission for a manager-relevant section (orders, reports, inventory, payroll, resort_ops, rooms, schedules, setup, timesheet).

View-only permissions like `rooms:view` or `schedules:view` should NOT trigger the Dashboard button, since those views are already available within the Employee Portal tabs.

Logic:
```
const MANAGER_SECTIONS = ['orders', 'reports', 'inventory', 'payroll', 
  'resort_ops', 'rooms', 'schedules', 'setup', 'timesheet'];
const hasManagerAccess = empPermissions.includes('admin') || 
  MANAGER_SECTIONS.some(s => canEdit(empPermissions, s));

if (hasManagerAccess) {
  tabs.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
}
```

### 2. Add permission check to /manager route
**File: `src/App.tsx`**

Currently `/manager` has no specific permission requirement, so any authenticated employee can navigate there directly. Add a guard — but since manager access requires any one of several edit-level permissions (not a single key), the simplest approach is to let `ManagerPage` handle the redirect (it already shows "No dashboard access" for employees with zero permissions). No route change needed since the EmployeePortal fix prevents normal access.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/EmployeePortal.tsx` | Replace `empPermissions.length > 0` with edit-level permission check for Dashboard tab |

## Result
- Susan (all view-only): sees Clock, Schedule, Tasks, Settings in Employee Portal. No Dashboard button. Cannot reach /manager.
- James (admin): sees all tabs including Dashboard, which goes to /admin.
- Staff with edit permissions: sees Dashboard, which goes to /manager with appropriate tabs.
