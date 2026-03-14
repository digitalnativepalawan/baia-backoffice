

## Plan: Fix Housekeeping Staff Filtering, Button Navigation & Role-Based Views

### Issues Identified

1. **HousekeeperPickerModal shows all staff** — The query filters by `employee_permissions` with `housekeeping%` permission, but also falls back to showing ALL employees if none match. Additionally, it should also check the `employee_roles` table for `builtin:housekeeping` role assignments.

2. **Housekeeping tab in StaffShell flashes and opens HousekeepingConfig** — In `StaffShell.tsx`, the Housekeeping tab renders `HousekeepingHome` → `HousekeeperPage`, which is correct. The "flashing" is the `tab-pulse` CSS class triggered by `useDepartmentAlerts` when there are pending housekeeping orders. The real issue is likely in the **AdminPage** (line 711) where the housekeeping tab shows `HousekeepingConfig` (configuration) instead of the operational dashboard.

3. **Housekeeping staff see all rooms instead of only assigned ones** — `HousekeeperPage` shows both `pendingOrders` (unassigned) and `myInProgress` (assigned to me). Housekeeping staff should only see orders assigned to them, while admin/reception/assistantGM should see all and be able to assign.

### Changes

#### 1. `src/components/rooms/HousekeeperPickerModal.tsx` — Filter to housekeeping staff only

- Query `employee_roles` table for `role_key = 'builtin:housekeeping'` in addition to checking `employee_permissions`
- Combine both sets of IDs
- Remove the fallback that shows all employees when no housekeeping staff found — instead show "No housekeeping staff found"

#### 2. `src/pages/AdminPage.tsx` — Housekeeping tab shows operational view

- Change the housekeeping `TabsContent` (line 710-712) from rendering `HousekeepingConfig` to rendering `HousekeeperPage embedded` (the operational dashboard showing rooms to clean/assign)
- Keep `HousekeepingConfig` in the Setup tab where it already exists (line 889)

#### 3. `src/pages/HousekeeperPage.tsx` — Role-based view filtering

- Import `getStaffSession` and check permissions
- If user has `admin`, `reception:edit`/`reception:manage`, or `assistantGM`-level access → show ALL orders (pending + in-progress by anyone) with ability to assign
- If user is housekeeping-only staff → hide unassigned "Assignments" section, only show "My In Progress" (orders assigned to or accepted by them) and "Completed Today"

#### Files to edit

| File | Change |
|------|--------|
| `src/components/rooms/HousekeeperPickerModal.tsx` | Also query `employee_roles` for `builtin:housekeeping`, remove all-staff fallback |
| `src/pages/AdminPage.tsx` | Change housekeeping tab from `HousekeepingConfig` to `HousekeeperPage embedded` |
| `src/pages/HousekeeperPage.tsx` | Add role check: housekeeping-only staff see only their assigned orders; admin/reception/AGM see all + can assign |

