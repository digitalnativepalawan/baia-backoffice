

# Add Food Profit to Resort Ops KPI Dashboard

## The Problem

The Resort Ops KPI cards show **Food Cost** but never use it in the profit calculation. Currently:
- Net Profit = Room Revenue - Total Expenses (food cost ignored)
- Food revenue from restaurant orders is not shown at all

You can see food profit data in the **Reports** tab, but it's missing from Resort Ops where you'd want a full picture.

## The Fix

Update the KPI section to include food revenue and food profit, and factor them into the overall Net Profit.

### Updated KPI Cards (8 cards in a 3-column grid)

| Card | Calculation |
|---|---|
| Room Revenue | Sum of booking `paid_amount` (unchanged) |
| Food Revenue | Sum of order `total` for the month (new) |
| Total Revenue | Room Revenue + Food Revenue (new) |
| Food Cost | From recipe costs (unchanged) |
| Food Profit | Food Revenue - Food Cost (new) |
| Total Expenses | Sum of expenses (unchanged) |
| Net Profit | Total Revenue - Food Cost - Total Expenses (updated) |
| Margin % | Net Profit / Total Revenue (updated) |

## Technical Details

### File: `src/components/admin/ResortOpsDashboard.tsx`

1. Add a `foodRevenue` calculation from the existing `orders` query (sum of `order.total`)
2. Add a `totalRevenue` = `revenue` (room) + `foodRevenue`
3. Add a `foodProfit` = `foodRevenue` - `foodCost`
4. Update `netProfit` = `totalRevenue` - `foodCost` - `totalExpenses`
5. Update `margin` = `netProfit / totalRevenue`
6. Add the new KPI cards to the display grid

No database changes needed -- all data already exists.
