

# Fix Employee Portal to Respect Admin Permission Settings

## Problem
The Employee Portal shows Schedule and Tasks tabs to ALL employees, ignoring the permissions configured by admin in Staff Access Manager. For example, if Susan has Schedules set to "Off" and no task permissions, she can still see and use those tabs.

## Solution

### 1. Add "Tasks" Permission Key to StaffAccessManager
**File: `src/components/admin/StaffAccessManager.tsx`**

The `GRANULAR_PERMISSIONS` array currently has `schedules` but no `tasks` key. Add a new entry:
- `{ key: 'tasks', label: 'Tasks' }`

This lets admins control task access per employee (Off / View / Edit).

### 2. Filter Employee Portal Tabs by Permissions
**File: `src/pages/EmployeePortal.tsx`**

The `empPermissions` array (line 88) already fetches the employee's permissions. Use `hasAccess()` from `@/lib/permissions` to conditionally include tabs:

- **Clock** tab: Always visible (basic timeclock for all staff)
- **Schedule** tab: Only if `hasAccess(empPermissions, 'schedules')` or admin
- **Tasks** tab: Only if `hasAccess(empPermissions, 'tasks')` or admin
- **Pay** tab: Only if `hasAccess(empPermissions, 'payroll')` or admin
- **Settings** tab: Always visible (own display name)
- **Dashboard** tab: Already permission-gated (unchanged)

### 3. Restrict Task Actions for View-Only Users
**File: `src/components/employee/EmployeeTaskList.tsx`**

Add a `readOnly` prop. When true:
- Hide "Add Task" button
- Hide Edit and Delete buttons
- Keep the checkmark (complete/uncomplete) visible only for Edit-level access
- View-level users can see their tasks but not modify them

The Employee Portal will pass `readOnly={!canEdit(empPermissions, 'tasks')}` to the task list.

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/StaffAccessManager.tsx` | Add `tasks` to `GRANULAR_PERMISSIONS` |
| `src/pages/EmployeePortal.tsx` | Import `hasAccess`/`canEdit`, filter tabs based on `empPermissions` |
| `src/components/employee/EmployeeTaskList.tsx` | Add `readOnly` prop to hide add/edit/delete when user lacks edit permission |
