

## Comprehensive Resort Management System -- Integration Plan

### What Already Exists (No Changes Needed)
- Schedule timeline grid with shift blocks, presets, context menus, copy week
- Rooms dashboard with check-in/out, guest info, orders, docs, notes, tours, vibe
- Inventory system with stock tracking, low alerts, usage logs
- Employee tasks with assignments, due dates, status tracking
- Staff permissions (3-tier: Off/View/Edit per section)
- Admin tabs: Setup, Menu, Orders, Reports, Inventory, HR, Resort Ops, Rooms, Timesheet, Schedules
- Dark theme (#0F172A), mobile-first stacked cards

### What Needs to Be Built (New Features)

---

### Phase 1: Database Schema (5 new tables)

**`room_types`** -- Configurable room types
- id, name, created_at

**`housekeeping_checklists`** -- Inspection items per room type
- id, room_type_id (FK), item_label, is_required, count_expected (nullable), sort_order

**`cleaning_packages`** -- Default supply quantities per room type
- id, room_type_id (FK), name (e.g. "Deep Clean"), created_at

**`cleaning_package_items`** -- Individual supply line in a package
- id, package_id (FK to cleaning_packages), ingredient_id (FK to ingredients), default_quantity, created_at

**`housekeeping_orders`** -- Active housekeeping jobs triggered by checkout
- id, unit_name, room_type_id, status (pending_inspection / inspecting / cleaning / completed), assigned_to (employee_id, nullable), inspection_data (jsonb -- checklist results), damage_notes, cleaning_notes, supplies_used (jsonb -- actual quantities used), inspection_completed_at, cleaning_completed_at, created_at

Add `room_type_id` column to `units` table (nullable FK to room_types) so each room knows its type.

Add `status` column to `units` table (text, default 'ready') -- values: 'occupied', 'to_clean', 'ready'.

All tables get public RLS policies matching the existing pattern (open access for this app's auth model).

Enable realtime on `housekeeping_orders` for live status updates.

---

### Phase 2: Room Status Board + Housekeeping Workflow

**File: `src/components/admin/RoomsDashboard.tsx`** -- Enhance existing

- Add a **Room Status Board** view at the top of the rooms list showing color-coded cards:
  - Red = Occupied (guest name, checkout date)
  - Yellow = To Clean (assigned housekeeper, "Start Cleaning" button)
  - Green = Ready ("Check In" button)
- Room status auto-updates: check-in sets "occupied", checkout sets "to_clean", cleaning complete sets "ready"

**File: `src/components/admin/HousekeepingInspection.tsx`** -- New component

- Two-step flow:
  - **Step 1: Inspection** -- renders checklist items from `housekeeping_checklists` for the room's type. Each item is a checkbox with optional count field. Damage report textarea + photo upload. "Complete Inspection" button saves to `housekeeping_orders.inspection_data`.
  - **Step 2: Cleaning** -- shows cleaning package defaults (from `cleaning_package_items`), quantities are editable. Notes field. "Cleaning Completed" button:
    - Deducts actual quantities from `ingredients` table
    - Logs deductions to `inventory_logs`
    - Updates `units.status` to 'ready'
    - Updates `housekeeping_orders.status` to 'completed'

**Checkout integration**: When admin clicks "Check Out Guest" in RoomsDashboard:
1. Booking checkout date updated (existing)
2. `units.status` set to 'to_clean'
3. New `housekeeping_orders` record created with status 'pending_inspection'
4. Toast notification shown

---

### Phase 3: Admin Configuration Panels

**File: `src/components/admin/HousekeepingConfig.tsx`** -- New component (added to Setup tab)

Three sub-sections:

1. **Room Types** -- CRUD list (Suite, Standard, Deluxe Cottage, Villa). Assign room type to each unit.

2. **Inspection Checklists** -- Per room type, manage checklist items (label, required toggle, expected count). Reorderable list.

3. **Cleaning Packages** -- Per room type, define supply packages. Each package maps ingredients from existing inventory to default quantities. Edit/Duplicate/Delete packages.

**File: `src/pages/AdminPage.tsx`** -- Add HousekeepingConfig to Setup tab

---

### Phase 4: Task Icons on Schedule Timeline

**File: `src/components/admin/WeeklyScheduleManager.tsx`** -- Enhance

- Query `employee_tasks` for the visible week
- Render task icons on employee timeline rows at their due time position
- Icon colors: blue = pending, green = completed, red = overdue, yellow = in progress
- Tap icon opens task detail/edit modal
- Small task count badge on employee name if they have tasks that day

---

### Phase 5: Enhanced Permissions

**File: `src/lib/permissions.ts`** -- Add 'schedules', 'setup', 'timesheet' to recognized sections

**File: `src/components/admin/StaffAccessManager.tsx`** -- Add 'schedules', 'setup', 'timesheet' to GRANULAR_PERMISSIONS array

**File: `src/pages/AdminPage.tsx`** / **ManagerPage.tsx** -- Check permissions for schedules/setup/timesheet tabs visibility and read-only state

---

### Implementation Order

This should be built in **3-4 separate prompts** after approval:

1. **Prompt 1**: Database migrations (all 5 tables + column additions) + Room Types config UI
2. **Prompt 2**: Housekeeping workflow (inspection + cleaning components) + Room status board + checkout integration
3. **Prompt 3**: Cleaning packages + inspection checklists admin config + inventory deduction on cleaning
4. **Prompt 4**: Task icons on timeline + enhanced permissions for schedules/setup/timesheet

### Technical Notes

- All new components follow existing patterns: `bg-navy-texture`, `font-display` headers, `font-body` text, `border-border` cards, 44px touch targets
- Housekeeping supply deduction reuses the same `inventory_logs` pattern as kitchen order deductions
- Room status is derived from `units.status` column, kept in sync by check-in/checkout/cleaning actions
- No new auth required -- uses existing admin login gate and employee portal auth

