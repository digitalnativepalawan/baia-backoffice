

## Housekeeping System Enhancement: Staff Accountability and Mobile Portal

### What Already Exists (No Changes Needed)
- `housekeeping_orders` table with inspection/cleaning workflow
- `housekeeping_checklists` per room type (admin-configurable)
- `cleaning_packages` with inventory deduction from housekeeping department
- `HousekeepingConfig.tsx` (admin checklist/package setup)
- `HousekeepingInspection.tsx` (inspection + cleaning with inventory deduction)
- Checkout auto-creates housekeeping orders

### 1. Database Migration

Add accountability columns to existing `housekeeping_orders` table:

```text
ALTER TABLE housekeeping_orders ADD COLUMN:
  - accepted_by UUID (references employees)
  - accepted_by_name TEXT
  - accepted_at TIMESTAMPTZ
  - completed_by_name TEXT
  - priority TEXT DEFAULT 'normal'
  - inspection_by_name TEXT
  - cleaning_by_name TEXT
  - time_to_complete_minutes INTEGER
```

No new tables needed -- the existing `housekeeping_orders` + `housekeeping_checklists` structure covers everything. Adding staff attribution columns is sufficient.

### 2. New Page: Housekeeper Portal (`src/pages/HousekeeperPage.tsx`)

Mobile-first page at `/housekeeper` route. Sections:

- **My Assignments**: Pending orders the housekeeper can accept (password-confirm to accept)
- **In Progress**: Orders they've accepted, with "Continue" button leading to existing `HousekeepingInspection` component
- **Completed Today**: Summary of finished rooms
- **My Stats**: Rooms cleaned this month, average time

Uses existing `housekeeping_orders` query filtered by `accepted_by` (or all pending for acceptance).

### 3. Password Confirmation Component (`src/components/housekeeping/PasswordConfirmModal.tsx`)

Dialog that requires PIN entry before:
- Accepting an assignment (sets `accepted_by`, `accepted_at`)
- Completing inspection (sets `inspection_by_name`)
- Completing cleaning (sets `cleaning_by_name`, `completed_by_name`)

Verifies PIN against the `employee-auth` edge function (already exists).

### 4. Update `HousekeepingInspection.tsx`

- Record `inspection_by_name` when completing inspection
- Record `cleaning_by_name` and calculate `time_to_complete_minutes` when completing cleaning
- Add password confirmation before completing each step
- Include `department: 'housekeeping'` in inventory log entries

### 5. Performance Dashboard (`src/components/admin/HousekeepingPerformance.tsx`)

New sub-section in Admin, accessible from Rooms or Reports tab:
- Table: housekeeper name, rooms cleaned, average time, inspection results
- Filters: date range, housekeeper
- Derived from `housekeeping_orders` data (accepted_by, timestamps, inspection_data)

### 6. Add Route in `App.tsx`

```text
/housekeeper -> RequireAuth -> HousekeeperPage
```

### 7. Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add accountability columns to `housekeeping_orders` |
| `src/pages/HousekeeperPage.tsx` | NEW -- mobile housekeeper portal |
| `src/components/housekeeping/PasswordConfirmModal.tsx` | NEW -- PIN confirmation dialog |
| `src/components/admin/HousekeepingPerformance.tsx` | NEW -- performance dashboard |
| `src/components/admin/HousekeepingInspection.tsx` | EDIT -- add staff attribution + password gates |
| `src/App.tsx` | EDIT -- add /housekeeper route |
| `src/pages/Index.tsx` | EDIT -- add Housekeeping button for staff navigation (if applicable) |

### Key Design Decisions
- Reuse the existing `HousekeepingInspection` component inside the housekeeper portal rather than rebuilding inspection/cleaning screens
- Performance stats are computed from query aggregation on `housekeeping_orders` (no separate counters table needed)
- PIN verification uses the existing `employee-auth` edge function
- No new permissions columns on employees -- use existing `employee_permissions` table with `housekeeping:view` / `housekeeping:edit` levels already supported by StaffAccessManager

