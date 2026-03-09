

## Problem Analysis

The app uses a PIN-based auth system (not Supabase Auth), storing sessions in `sessionStorage` under `staff_home_session`. Three issues exist:

1. **Home button bug**: StaffShell's Home button navigates to `/` which is the login page — triggers re-auth even when session is active. AdminPage does the same for admins.
2. **No persistent navigation**: Each page has its own ad-hoc header with inconsistent nav options.
3. **No role-aware home routing**: After login, staff always land on `/staff` regardless of their primary role.

## Plan

### New file: `src/components/StaffNavBar.tsx`

A persistent top navigation bar used by all authenticated pages (StaffShell, AdminPage, EmployeePortal, and all legacy direct routes).

**Desktop layout** (horizontal bar):
```
[Home] [My Work] [Dashboard]                    [Staff Name] [Logout]
```

**Mobile layout** (compact):
```
[Home] [My Work]              [☰ hamburger → Dashboard, Logout]
```

**Logic:**
- Reads `staff_home_session` from sessionStorage to get name, permissions
- **Home** → calls `getHomeRoute(perms)` helper (see below)
- **My Work** → navigates to `/employee-portal` (which has tasks, schedule, clock)
- **Dashboard** → navigates to `/admin` (visible only if user has dashboard-level permissions)
- **Logout** → clears `sessionStorage.removeItem('staff_home_session')`, `localStorage.removeItem('emp_id')`, `localStorage.removeItem('emp_name')`, navigates to `/`

### New file: `src/lib/getHomeRoute.ts`

Helper function that determines the correct home route based on permissions:

```ts
export function getHomeRoute(perms: string[]): string {
  if (perms.includes('admin')) return '/admin';
  // Primary role = first matching permission
  if (hasAccess(perms, 'reception')) return '/staff'; // reception tab auto-selected
  if (hasAccess(perms, 'kitchen')) return '/staff';
  if (hasAccess(perms, 'bar')) return '/staff';
  if (hasAccess(perms, 'housekeeping')) return '/staff';
  return '/staff';
}
```

Staff all route to `/staff` since the StaffShell already auto-selects their first available role tab. The key fix is that Home never goes to `/` for authenticated users.

### Modified files

**`src/pages/StaffShell.tsx`**
- Replace the ad-hoc header with `<StaffNavBar />`
- Remove the Home button that navigates to `/`
- Remove the inline Logout button (now in nav bar)
- Keep the role switcher tabs and content as-is

**`src/pages/AdminPage.tsx`** (lines ~453-462)
- Replace the ad-hoc header (Home icon + "Dashboard" title) with `<StaffNavBar />`
- Remove the Home button that navigates to `/`

**`src/pages/EmployeePortal.tsx`**
- Add `<StaffNavBar />` at the top
- Remove any duplicate Home/Logout buttons

**`src/components/RequireAuth.tsx`**
- No changes needed — it already redirects to `/` when session is missing, which is correct

**`src/pages/Index.tsx`**
- Already has auto-redirect for existing sessions (lines 39-49) — no changes needed

### What this fixes

- **Home button bug**: Home navigates to `/staff` or `/admin` instead of `/`
- **Logout visibility**: Always visible in the nav bar across all pages
- **Consistent navigation**: Same nav bar on every authenticated page
- **Mobile friendly**: Hamburger menu on small screens
- **Staff landing**: Already works — staff land on `/staff` which auto-selects their first role tab. The StaffShell role switcher handles the "landing on their department" requirement.

### Files summary

```
NEW:  src/components/StaffNavBar.tsx
NEW:  src/lib/getHomeRoute.ts
EDIT: src/pages/StaffShell.tsx     — replace header with StaffNavBar
EDIT: src/pages/AdminPage.tsx      — replace header with StaffNavBar
EDIT: src/pages/EmployeePortal.tsx — add StaffNavBar
```

No database changes needed. No existing functionality removed.

