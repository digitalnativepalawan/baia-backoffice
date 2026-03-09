

## Complete Restock of Kitchen Inventory

### Current State
- **Kitchen**: 25 items below threshold (81 total items)
- **Bar**: 0 items in inventory (no bar department ingredients exist yet)

### The 25 Low-Stock Kitchen Items
| Item | Current | Threshold | Unit |
|------|---------|-----------|------|
| Lemon/Calamansi | 25 | 200 | ml |
| Chorizo | 40 | 200 | grams |
| Mango | 40 | 200 | grams |
| Cured Pork | 40 | 200 | grams |
| Milk | 50 | 200 | ml |
| Tuna | 50 | 200 | grams |
| Watermelon | 100 | 200 | grams |
| Tomato Marinara | 100 | 200 | grams |
| + 17 more... | ... | 200 | ... |

### Restock Plan

I will run a single UPDATE to set all low-stock items to **500 units** (2.5× threshold), which gives a comfortable buffer without excessive inventory.

**SQL to execute:**
```sql
UPDATE ingredients
SET current_stock = 500
WHERE department IN ('kitchen', 'bar')
  AND current_stock < low_stock_threshold
  AND low_stock_threshold > 0;
```

Then log each restock as a `stock_input` entry in `inventory_logs` for audit trail.

### File Changes
None — this is a data update only using the database insert tool.

