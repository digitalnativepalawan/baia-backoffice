

## Support Split Shifts and Lunch Breaks

### What Already Works
The database already handles multiple shifts per day correctly. Each clock-in creates a new `employee_shifts` row, and clocking out closes only that row. The `getTodayHours` function sums all completed shifts for the day. So an employee can clock out for lunch and clock back in without any data issues.

### What Needs Improvement

**1. Employee Page -- Show today's shift breakdown**
Currently the employee card only shows "Today: 3.5h" as a single number. Employees can't see their individual shift segments. We'll add a small list of today's shifts under each employee card showing:
- Shift 1: 8:00 AM - 12:00 PM (4.0h)
- Shift 2: 1:30 PM - still working

This makes it clear to the employee that their lunch break was recorded and they're on their second (or third) shift.

**2. Employee Page -- Show shift count label**
Add a "Split Shift" or "2 shifts" indicator when an employee has more than one shift today, so it's obvious at a glance.

**3. Admin Payroll -- Group shifts by day per employee**
In the Shift Log, when an employee has multiple shifts on the same day, visually group them together and show a "Split Shift" badge with a daily total. This helps admin quickly see the full picture for that day.

**4. CSV Export -- Add daily totals for split shifts**
When exporting, add a subtotal row for days where an employee worked multiple shifts, making it clear for accounting.

### Technical Details

**File: `src/pages/EmployeePage.tsx`**
- Filter today's shifts per employee (already available in `shifts` array)
- Render a compact list of shift segments below the summary line
- Show shift count badge (e.g., "2 shifts") when count > 1
- No database changes needed

**File: `src/components/admin/PayrollDashboard.tsx`**
- In the Shifts sub-view, group `filteredShifts` by employee + date
- When a group has more than 1 shift, show a "Split Shift" badge and a daily subtotal row
- In `downloadCSV`, insert a subtotal row after each multi-shift day grouping

No database or schema changes required -- this is purely a UI/display enhancement.
