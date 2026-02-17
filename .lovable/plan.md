

## Resort Operations Dashboard

### Overview
Add a new "Resort Ops" tab to the Admin Dashboard with a full operations management view: KPI cards, reservations ledger, occupancy grid, unit performance, expenses, tasks, assets, and incoming payments -- all filtered by selectable month.

### Important: Table Naming
Your app already has a `units` table (for measurement units like grams/ml) and an `expenses` table (for receipt scanning). To avoid conflicts, the new tables will use the prefix `resort_ops_`:

| Requested Name | Actual Table Name |
|---|---|
| units | `resort_ops_units` |
| guests | `resort_ops_guests` |
| bookings | `resort_ops_bookings` |
| expenses | `resort_ops_expenses` |
| tasks | `resort_ops_tasks` |
| assets | `resort_ops_assets` |
| incoming_payments | `resort_ops_incoming_payments` |

### Database Tables (7 new tables)

**resort_ops_units** -- id (uuid PK), name (text), type (text), base_price (numeric), capacity (int), created_at

**resort_ops_guests** -- id (uuid PK), full_name (text), email (text), phone (text), created_at

**resort_ops_bookings** -- id (uuid PK), guest_id (uuid FK), unit_id (uuid FK), platform (text), check_in (date), check_out (date), adults (int), room_rate (numeric), addons_total (numeric default 0), paid_amount (numeric default 0), commission_applied (numeric default 0), created_at

**resort_ops_expenses** -- id (uuid PK), name (text), category (text), amount (numeric), expense_date (date), created_at

**resort_ops_tasks** -- id (uuid PK), title (text), description (text), category (text), due_date (date), priority (text: low/medium/high/critical), status (text: pending/in_progress/done), created_at

**resort_ops_assets** -- id (uuid PK), name (text), balance (numeric), type (text), last_updated (timestamptz), created_at

**resort_ops_incoming_payments** -- id (uuid PK), source (text), amount (numeric), expected_date (date), created_at

All tables get public RLS policies (matching existing pattern) and realtime enabled for bookings.

### New Files

**`src/components/admin/ResortOpsDashboard.tsx`** -- Main component containing:

1. **Month selector** -- Row of buttons for the specified months (2025-10 through 2026-09). Active month highlighted with primary style.

2. **KPI Cards** (6 cards in 2x3 grid):
   - Revenue = sum of `paid_amount` from bookings in selected month
   - Food Cost = pulled from existing orders/menu data for that month (reuses Reports logic)
   - Net Profit = Revenue - Total Expenses
   - Margin % = (Net Profit / Revenue) * 100
   - Room Revenue = same as Revenue (from bookings)
   - Total Expenses = sum of `resort_ops_expenses` in selected month

3. **Reservations Ledger** -- Table showing bookings: guest name (joined from guests), unit name, check-in/out, platform, room rate, paid amount, balance owed (room_rate - paid_amount)

4. **Occupancy Grid** -- For each unit, show a 30-day horizontal bar. Each day colored if a booking overlaps that date. Shows occupancy % per unit. Color coding: GREEN (>90%), AMBER (50-90%), RED (<50%)

5. **Unit Performance Table** -- Per unit: projected revenue (base_price x days in month), realized revenue (sum of paid_amount), variance, and status badge (HIGH/ON_TRACK/LOW)

6. **Expenses Ledger** -- Simple table of resort_ops_expenses for selected month with name, category, amount, date. Inline "Add Expense" row.

7. **Tasks List** -- Filtered by month. Shows title, category, priority badge, due date, status. Overdue items highlighted in red. Critical priority items get a pulsing indicator.

8. **Assets on Hand** -- Table of resort_ops_assets with name, type, balance, last updated.

9. **Incoming Payments** -- Table of resort_ops_incoming_payments with source, amount, expected date. Filtered to selected month.

Each section has an inline add/edit capability using the same Input/Button patterns as the rest of the admin dashboard.

### Modified Files

**`src/pages/AdminPage.tsx`**
- Add import for `ResortOpsDashboard`
- Add a new `TabsTrigger` value="resort-ops" labeled "Resort Ops" in the tab bar
- Add corresponding `TabsContent` rendering `<ResortOpsDashboard />`

No changes to `App.tsx` (no new route needed -- it lives inside the existing Admin page as a tab).

### Calculation Logic

All calculations happen client-side in `useMemo` hooks:

```text
Revenue = SUM(bookings.paid_amount) where check_in falls in selected month
Total Expenses = SUM(resort_ops_expenses.amount) where expense_date falls in selected month
Net Profit = Revenue - Total Expenses
Margin % = Revenue > 0 ? (Net Profit / Revenue) * 100 : 0
Occupancy % = (booked_nights / total_nights_in_month) * 100 per unit
Unit Status = occupancy > 90% ? "HIGH" : occupancy >= 50% ? "ON_TRACK" : "LOW"
```

### What Is NOT Changed
- No modifications to existing Orders, Menu, Inventory, Payroll, Reports, or Setup tabs
- No changes to authentication, navigation structure, or global state
- No modifications to existing database tables
- Existing `units` (measurement) and `expenses` (receipt) tables are untouched
- All styling reuses existing CSS variables and utility classes

