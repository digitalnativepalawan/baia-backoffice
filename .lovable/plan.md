

## Fix: Remove Horizontal Scroll from Reports Dashboard

### Problem
The Item Profit Breakdown section uses a traditional HTML table with 6 columns (Item, Qty, Revenue, Cost, Profit, Margin), wrapped in `overflow-auto`. This causes horizontal scrolling on mobile, which violates the project's layout constraints.

### Solution
Replace the `<Table>` component with **stacked card rows** -- one card per item -- showing all data vertically without any horizontal overflow.

### Changes

**File: `src/components/admin/ReportsDashboard.tsx`** (lines 346-376)

Replace the `<Table>` / `overflow-auto` block with a vertical list of items, each rendered as a compact stacked layout:

```
+------------------------------------------+
| Mango Shake                              |
| Qty: 12   Revenue: P1,800                |
| Cost: P480   Profit: P1,320   Margin: 73%|
+------------------------------------------+
```

Each item will be a bordered `div` with the item name as a header and two rows of key-value pairs underneath, using `flex-wrap` and small text to fit cleanly on mobile.

No other files need changes. No database changes needed.
