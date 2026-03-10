

## Plan: Centralized Permission Enforcement Across All Modules

### Current State
- `src/lib/permissions.ts` already has `hasAccess`, `canEdit`, `canManage`, `getPermissionLevel` functions
- `src/lib/session.ts` has `getStaffSession()` for reading the session
- AdminPage already filters tabs by permission and passes `readOnly()` to some components
- **Components WITH readOnly support**: PayrollDashboard, WeeklyScheduleManager, InventoryDashboard, ResortOpsDashboard, ReportsDashboard, RoomsDashboard
- **Components WITHOUT readOnly support**: HousekeepingConfig, TimesheetDashboard, DepartmentOrdersView, ExperiencesPage, HousekeepingConfig, StaffAccessManager (admin-only)
- No centralized `usePermissions` hook exists — each page re-reads session and calls helpers manually
- RLS is currently open (all public) — no server-side permission enforcement

### Changes

#### 1. Create `src/hooks/usePermissions.ts`
Central hook that reads session once and exposes:
```typescript
const { perms, isAdmin, canView, canEdit, canManage, readOnly, session } = usePermissions();
// canView('schedules') → boolean
// canEdit('schedules') → boolean  
// readOnly('schedules') → boolean (has access but not edit)
```
Wraps existing `lib/permissions.ts` functions with session context.

#### 2. Update `src/components/RequireAuth.tsx`
- Import and use `usePermissions` internally instead of manually reading session
- No behavior change, just DRY refactor

#### 3. Update `src/components/StaffNavBar.tsx`
- Use `usePermissions` hook to hide nav items user cannot access (e.g., hide Dashboard if no dashboard-level permissions)
- Already partially done — just switch to the hook

#### 4. Add readOnly prop to components missing it

**`src/components/admin/HousekeepingConfig.tsx`**
- Add `readOnly` prop, hide create/delete/edit buttons when true
- AdminPage already wraps it in `pointer-events-none` — replace with proper prop

**`src/components/admin/TimesheetDashboard.tsx`**
- Add `readOnly` prop, hide edit/delete/pay buttons when true
- AdminPage already wraps it in `pointer-events-none` — replace with proper prop

**`src/components/DepartmentOrdersView.tsx`**
- Already uses `canEdit`/`canManage` from permissions — already enforced via session
- No change needed (it reads session internally)

**`src/pages/ReceptionPage.tsx`**
- Already reads session permissions internally and computes `canDoEdit`
- No change needed

**`src/pages/ExperiencesPage.tsx`**
- Check current readOnly enforcement — add if missing

#### 5. Update AdminPage to use hook + pass readOnly properly
- Replace manual `getSession()` / `readOnly()` with `usePermissions` hook
- Pass `readOnly` prop to HousekeepingConfig and TimesheetDashboard instead of CSS wrapper hack

#### 6. No RLS changes needed
The tables use a staff session system (not Supabase Auth) — all API calls go through the anon key. RLS is intentionally open because authentication is handled at the application layer via employee PIN/password, not Supabase auth tokens. Adding restrictive RLS would break all functionality since there are no Supabase auth users. The current permission enforcement is client-side by design.

### Files
```
CREATE  src/hooks/usePermissions.ts
EDIT    src/components/RequireAuth.tsx (use hook)
EDIT    src/components/StaffNavBar.tsx (use hook)
EDIT    src/pages/AdminPage.tsx (use hook, pass readOnly properly)
EDIT    src/components/admin/HousekeepingConfig.tsx (add readOnly prop)
EDIT    src/components/admin/TimesheetDashboard.tsx (add readOnly prop)
EDIT    src/pages/ExperiencesPage.tsx (check/add readOnly enforcement)
```

