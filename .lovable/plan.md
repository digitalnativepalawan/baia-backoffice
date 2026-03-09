

## Add "Remember Me on This Device" for Staff Login

### Problem

Currently all staff sessions use `sessionStorage`, which is wiped when the browser tab/window closes. Staff have to re-enter name + PIN every time they open the app — frustrating on dedicated tablets and phones.

### Solution

Add a "Remember me on this device" checkbox to the login screen. When checked, store the session in `localStorage` instead of `sessionStorage`, so it persists across browser restarts. The session still expires after 8 hours (or can be extended to 24h/7d for remembered devices). When unchecked, behavior stays the same as today.

### Changes

**1. Create a shared session helper — `src/lib/session.ts`**

A single module that all components import instead of directly calling `sessionStorage`:

- `getStaffSession()` — checks `localStorage` first (remembered), then `sessionStorage`, validates expiry
- `setStaffSession(session, remember: boolean)` — writes to the correct storage; if `remember`, also store a `staff_remember` flag in `localStorage`
- `clearStaffSession()` — removes from both storages
- `isRemembered()` — checks if `staff_remember` flag exists

This centralizes the ~15 scattered `sessionStorage.getItem/setItem/removeItem('staff_home_session')` calls across the codebase.

**2. Update `src/pages/Index.tsx` — Add checkbox + use helper**

- Add a "Remember me on this device" checkbox below the PIN field
- Pass `remember` boolean to `setStaffSession()`
- When remembered, extend session to 7 days instead of 8 hours
- Replace direct `sessionStorage` calls with the helper

**3. Update all session consumers to use the helper**

Files that read/write the session directly:
- `src/components/RequireAuth.tsx` — `getStaffSession()` / `clearStaffSession()`
- `src/components/admin/AdminLoginGate.tsx` — `getStaffSession()` / `setStaffSession()` / `clearStaffSession()`
- `src/components/StaffNavBar.tsx` — `clearStaffSession()`
- `src/components/DepartmentOrdersView.tsx` — read session + `clearStaffSession()`
- `src/components/service/ServiceHeader.tsx` — read session + `clearStaffSession()`
- `src/components/service/ServiceBoard.tsx` — read session permissions
- `src/pages/EmployeePortal.tsx` — read session
- `src/pages/ServiceModePage.tsx` — read session

### File Summary

```
CREATE: src/lib/session.ts                          — centralized session read/write/clear
EDIT:   src/pages/Index.tsx                          — add "Remember me" checkbox, use helper
EDIT:   src/components/RequireAuth.tsx                — use helper
EDIT:   src/components/admin/AdminLoginGate.tsx       — use helper
EDIT:   src/components/StaffNavBar.tsx                — use helper
EDIT:   src/components/DepartmentOrdersView.tsx       — use helper
EDIT:   src/components/service/ServiceHeader.tsx      — use helper
EDIT:   src/components/service/ServiceBoard.tsx       — use helper
EDIT:   src/pages/EmployeePortal.tsx                  — use helper
EDIT:   src/pages/ServiceModePage.tsx                 — use helper
```

No database changes needed.

