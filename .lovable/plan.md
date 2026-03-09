

## Fix: Remove Redundant Department Badge from Staff Home

### Problem

When a staff member (or admin) logs into `/staff`, the navbar immediately shows a "RECEPTION" badge. This is confusing because it's not indicating the user's actual role — it's simply the first item in the `ROLES` array being passed as `activeDepartment` to `StaffNavBar`.

The role switcher tabs already show which department is active, making the badge redundant and misleading on the Staff Shell.

### Fix

**`src/pages/StaffShell.tsx`** — Stop passing `activeDepartment` to `StaffNavBar` on the Staff Shell. The role switcher tabs already communicate the active department visually.

Change:
```tsx
<StaffNavBar activeDepartment={activeRole} />
```
To:
```tsx
<StaffNavBar />
```

This way the badge only appears on dedicated department pages (e.g. `/kitchen`, `/reception`) where it's contextually meaningful, not on the multi-role staff home.

### Files Changed

```
EDIT  src/pages/StaffShell.tsx  — Remove activeDepartment prop from StaffNavBar
```

