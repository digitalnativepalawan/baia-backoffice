

## Fix Inventory Reorder Alerts — Set Default Stock Levels

All 81 ingredients currently show 0 stock (from the recent data reset), triggering "OUT" alerts across the board. This is a data-only fix — no code changes.

### Action

Run a single database update to set all ingredients to a comfortable default stock level above their low_stock_threshold, silencing all reorder alerts:

```sql
UPDATE ingredients 
SET current_stock = GREATEST(low_stock_threshold * 3, 500)
WHERE current_stock = 0;
```

This sets each ingredient's stock to **3x its threshold** (or minimum 500 units), ensuring nothing shows as "OUT" or "Needs Attention" until real inventory tracking begins.

### What changes
- All 81 ingredients get a default stock level
- Reorder Alerts section will show empty (no items need attention)
- "Out of Stock" and "Needs Attention" counters drop to 0

### What doesn't change
- No code files modified
- Ingredient names, units, thresholds, costs all stay the same
- When real kitchen operations begin, actual stock tracking will override these defaults

| Change | Details |
|--------|---------|
| Database | `UPDATE ingredients SET current_stock` for all rows |
| Files | None |

