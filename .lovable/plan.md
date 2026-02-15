

## Reports Dashboard: Food Cost, Profit Analysis, and CSV Export

### What We're Building
A comprehensive accounting reports tool that replaces the "Coming Soon" placeholder with real food cost and profit analysis, adds flexible date range selection (including custom date picker), and enables CSV download for accounting purposes.

### Key Issues to Fix First
1. **Reports currently only show "Closed" orders** -- but we changed tab closure to mark orders as "Paid". The query needs to include BOTH "Paid" and "Closed" statuses to capture all completed transactions.

### Changes

### 1. Expanded Date Range Options
Replace the 4 simple buttons with a more complete set for accounting:
- Today, Yesterday, This Week, This Month, Year to Date
- Custom date range picker (two date inputs: From / To)

### 2. Food Cost and Profit Analysis Section
Since order items don't store `food_cost` in their JSON, we'll cross-reference item names against the `menu_items` table to look up each item's food cost.

For each item sold in the period:
- **Revenue**: price x quantity
- **Food Cost**: food_cost x quantity (from menu_items lookup)
- **Profit**: Revenue - Food Cost
- **Margin %**: (Profit / Revenue) x 100

Summary cards will show:
- Total Revenue | Total Food Cost | Total Profit | Overall Margin %

A per-item breakdown table showing name, qty sold, revenue, food cost, profit, and margin.

### 3. CSV Export Button
A "Download CSV" button that generates a CSV file with all transaction data for the selected period. The CSV will include:

**Transactions sheet data:**
- Order ID, Date/Time, Order Type, Location, Items (name, qty, price), Subtotal, Service Charge, Total, Payment Type, Status

**Summary data at the top:**
- Period, Total Revenue, Total Food Cost, Total Profit, Margin %

The filename will indicate the period (e.g., `report-2026-02-15-today.csv`).

### 4. Fix Order Query
Change from `.eq('status', 'Closed')` to `.in('status', ['Paid', 'Closed'])` so all completed orders are captured.

### Technical Details

**File: `src/components/admin/ReportsDashboard.tsx`** (major rewrite)

- Add `menu_items` query to fetch food_cost data for cross-referencing
- New date range type: `'today' | 'yesterday' | 'week' | 'month' | 'ytd' | 'custom'`
- Custom date state with two date pickers (using Popover + Calendar from shadcn)
- Fix query to use `.in('status', ['Paid', 'Closed'])`
- New `stats` calculations adding: `totalFoodCost`, `totalProfit`, `marginPct`, and per-item cost/profit breakdown
- Summary cards row: Revenue, Food Cost, Profit, Margin %
- Per-item profit table with columns: Item, Qty, Revenue, Cost, Profit, Margin
- `generateCSV()` function that builds CSV string from orders data and triggers download via `Blob` + `URL.createObjectURL`
- Remove the two "Coming Soon" placeholder sections (Food Cost and Tours)
- Keep the "Tours Revenue" placeholder as coming soon

No database changes needed -- all data already exists in `menu_items.food_cost` and order items JSON.

