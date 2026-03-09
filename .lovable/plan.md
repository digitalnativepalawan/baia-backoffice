
## Two bugs to fix

---

### Bug 1 — Admin navigating to staff portals requires re-login

**Root cause:** When an admin is already signed in (session stored in `sessionStorage` as `staff_home_session`), clicking the Home button goes to `/` which shows the login screen. Navigation to `/staff`, `/employee-portal`, etc. from within AdminPage forces another login.

**Fix:** Add a "Staff View" or "Portal" quick-nav bar to the AdminPage header. Since the admin session is already in `sessionStorage`, navigating to `/staff` or `/employee-portal` should work without re-login — `RequireAuth` and `EmployeePortal` both read from the same `staff_home_session`. The issue is there's no easy way to get there.

**Changes to `src/pages/AdminPage.tsx`:**
- In the header row (the `<div>` with the Home button + "Dashboard" heading), add a small row of quick-nav buttons:
  - **Staff Console** → `navigate('/staff')`
  - **My Portal** → `navigate('/employee-portal')`
  - These buttons only appear if `isAdmin` is true
- Keep the Home button as-is

This means zero re-login — session is already valid, and both routes accept the existing `staff_home_session`.

---

### Bug 2 — Schedule modal creates duplicate date entries

**Root cause:** In `openAdd()` (line 247):
```ts
setShiftForm({
  employee_id: ...,
  schedule_date: d,
  time_in: '07:00',
  time_out: '16:00',
  selected_days: [d]   // ← date already in selected_days
});
```

Then in `saveShift()` (line 293):
```ts
const days = shiftForm.selected_days.length > 0 
  ? shiftForm.selected_days 
  : [shiftForm.schedule_date];
```

The `selected_days` array starts with `[d]` (the clicked date), which is correct. But then in `ShiftModal`, the day checkboxes let the admin click the same date again. There's no bug in that array logic per se.

**The actual duplicate issue:** When `openAdd()` is called with a specific date (e.g. clicking on a timeline row), `schedule_date` is set to `d` AND `selected_days` is also set to `[d]`. Both are in sync. However, the user can hit Save multiple times (no guard, no `disabled` state on the button during save) — OR — the realtime subscription triggers a UI refresh that re-renders the component while `saveShift` is still in flight, making it appear like duplicates were created from a single click.

**Additionally:** The `openAdd` call from the timeline row inline click handler (`onClick={() => openAdd(dateStr, emp.id)}` on the full timeline `<div>`) competes with the `+` button click — both fire on mobile due to event bubbling, causing two modal opens, and if saved rapidly, two inserts.

**Fixes in `src/components/admin/WeeklyScheduleManager.tsx`:**
1. Add a `saving` state flag to `saveShift` — disable the Save button while saving to prevent double-submit
2. Add `e.stopPropagation()` to the `+` button click in `TimelineRow` so it doesn't bubble to the `<div onClick>` behind it
3. Remove the full-row `<div onClick>` from the timeline (or make it require a double-click/long-press) — it's too easy to accidentally trigger an add while scrolling on mobile
4. In `ShiftModal`, when a specific date comes in via `openAdd(dateStr, empId)`, pre-check that date AND show it as locked (non-toggleable) so the user can only add more days, not accidentally create a multi-day batch unintentionally

---

### Files to change

| File | Change |
|---|---|
| `src/pages/AdminPage.tsx` | Add Staff Console + My Portal quick-nav buttons to the header |
| `src/components/admin/WeeklyScheduleManager.tsx` | Fix double-submit with `saving` guard; fix event bubbling on `+` button; remove accidental full-row click trigger |

No DB changes needed.
