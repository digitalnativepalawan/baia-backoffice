

## Two New Admin Features: Timesheet Management and Weekly Schedule Manager

### Overview
Add two new tabs ("Timesheet" and "Schedules") to the Admin Dashboard. Both features use the existing `employees` table for employee data, and each gets its own new database table and dedicated component.

---

### Database Changes

**1. New table: `time_entries`**
- `id` uuid PK, `employee_id` uuid, `entry_date` date, `clock_in` timestamptz, `clock_out` timestamptz (nullable), `is_paid` boolean default false, `paid_amount` numeric (nullable), `paid_at` timestamptz (nullable), `created_at` timestamptz default now(), `updated_at` timestamptz default now()
- RLS disabled (internal admin tool)

**2. New table: `weekly_schedules`**
- `id` uuid PK, `employee_id` uuid, `schedule_date` date, `time_in` time, `time_out` time, `created_at` timestamptz default now(), `updated_at` timestamptz default now()
- RLS disabled
- Realtime enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_schedules`

---

### New Files

**1. `src/components/admin/TimesheetDashboard.tsx`**
Full-featured timesheet management component containing:

- **Header**: Title "Timesheet Management" with Start/End date pickers, "Download CSV" button (blue), "Bulk Time In Sheet" upload button (green)
- **Calculate Hours & Pay card**: Start/End date pickers with green "Calculate" button. Shows Total Hours, Total Pay, and per-employee breakdown table (name, rate, hours, pay). Auto-recalculates on data change.
- **Time Entries list**:
  - Desktop: Table with columns (Employee, Date, Clock In, Clock Out, Hours, Status badge, Paid Amount, Actions)
  - Mobile: Stacked cards showing all fields vertically -- no horizontal scrolling
  - Actions: Edit (inline with save/cancel), Delete (confirmation dialog), Clock Out for active entries
  - Latest 20 entries, sorted by date desc
  - Real-time subscription on `time_entries` table
- **CSV Download**: Filters by selected date range, generates CSV (Employee, Date, Clock In, Clock Out, Hours, Rate, Pay, Paid Status, Paid Amount)
- **Bulk CSV Upload**: File input, parses CSV (handles quoted values), matches employee names from `employees` table, inserts rows into `time_entries`, shows success/error toasts

**2. `src/components/admin/WeeklyScheduleManager.tsx`**
Full-featured schedule manager containing:

- **Desktop view**: Grid with Employee column + 7 day columns (Sun-Sat). Header shows title, date input for week start, "Current Week" button, week range label. Each cell shows shift times or "+" button. Hover reveals Edit/Delete icons. Supports broken shifts (multiple entries per day per employee).
- **Mobile view**: "Today's Schedule" as stacked cards (employee name + shift time). Tapping employee opens modal with their full week schedule.
- **Shift Modal** (add/edit): Employee dropdown, date, time_in, time_out fields. Quick preset buttons: "Morning Shift" (7:00-16:00), "Evening Shift" (12:00-21:00), "Maintenance Shift" (8:00-17:00), "Broken Shift" (creates two entries: 7:00-11:00 + 17:00-21:00).
- **Employee Week Modal**: Shows full week for one employee, day by day as stacked cards.
- Real-time subscriptions on both `employees` and `weekly_schedules` tables.
- All times in 12-hour AM/PM format using date-fns.

---

### Updated Files

**`src/pages/AdminPage.tsx`**
- Import the two new components
- Add two new tabs: "Timesheet" and "Schedules"
- Add corresponding `TabsContent` sections rendering each component

---

### Technical Details

- Uses existing `employees` table (already has `id`, `name`, `hourly_rate`, `created_at`)
- Uses `useQuery` + real-time channel subscriptions (same pattern as existing `PayrollDashboard`)
- Uses `useIsMobile()` hook for responsive layout switching (cards on mobile, table/grid on desktop)
- shadcn/ui components: Card, Button, Dialog, Popover, Calendar, Input, Table, Label, AlertDialog, Select, Badge
- date-fns for formatting (format, startOfWeek, addDays, etc.)
- lucide-react for icons (Download, Upload, Plus, Pencil, Trash2, Clock, Check, X, etc.)
- Currency: Philippine Peso (₱)
- All times formatted in 12-hour AM/PM

