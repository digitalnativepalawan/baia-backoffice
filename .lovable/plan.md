

## Multi-Department Inventory Management

### Overview
Add a `department` column to ingredients and inventory logs so stock is tracked per department (Kitchen, Bar, Gardens, Rooms/Housekeeping). The inventory dashboard will get department tabs, a transfer feature, and department-scoped reporting.

### 1. Database Migration

Add `department` column to both `ingredients` and `inventory_logs` tables:
- `ingredients.department TEXT NOT NULL DEFAULT 'kitchen'` -- existing items default to kitchen
- `inventory_logs.department TEXT NOT NULL DEFAULT 'kitchen'`
- No CHECK constraints (use application-level validation per project conventions)

### 2. Update Inventory Dashboard (`src/components/admin/InventoryDashboard.tsx`)

Major refactor of the main component:

- **Department selector** at the top: pill/tab buttons for Kitchen, Bar, Gardens, Rooms/Housekeeping, and "All" 
- All queries filter by selected department (or show all)
- Summary cards (value, out-of-stock, low-stock) are department-scoped
- Low stock alerts are department-scoped
- **Add/Edit dialog** gets a department selector (radio group or dropdown)
- CSV export includes department column
- Usage log tab also filters by department

### 3. Stock Transfer Feature

New transfer dialog within InventoryDashboard:
- "Transfer" button appears in the toolbar
- Modal with: From Department, To Department, Ingredient (filtered by source dept), Quantity, Reason
- On submit: creates two inventory_log entries (negative from source, positive to destination) and updates stock on the ingredient
- Since ingredients are department-scoped, a transfer actually means moving quantity: decrement source ingredient stock, increment (or create) the matching ingredient in the target department

**Simpler approach**: Since each ingredient row has a department, a "transfer" will:
1. Reduce `current_stock` on the source ingredient
2. Find or create the same-named ingredient in the target department
3. Increase its `current_stock`
4. Log both changes in `inventory_logs`

### 4. Update Inventory Deduction Logic (`src/lib/inventoryDeduction.ts`)

- When deducting for orders, use `menu_items.department` to determine which department's ingredients to deduct from
- Recipe ingredients query should join through to get the ingredient's department
- This is mostly automatic since recipes already link menu items to specific ingredients -- as long as ingredients are assigned correct departments

### 5. Update Stock Check (`src/lib/stockCheck.ts`)

- No major changes needed since recipes already reference specific ingredient rows
- The department field is informational; the recipe linkage handles correctness

### 6. Update Recipe Editor (`src/components/admin/RecipeEditor.tsx`)

- When showing available ingredients for a recipe, optionally filter or group by department matching the menu item's department
- Show department badge next to each ingredient name

### 7. Files to Change

| File | Change |
|------|--------|
| Migration SQL | Add `department` column to `ingredients` and `inventory_logs` |
| `src/components/admin/InventoryDashboard.tsx` | Department tabs, filtered queries, department in add/edit form, transfer dialog, department in CSV |
| `src/lib/inventoryDeduction.ts` | Log department in inventory_logs inserts |
| `src/components/admin/RecipeEditor.tsx` | Show department badge on ingredients, group by department |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### 8. Department Values

```text
kitchen | bar | gardens | housekeeping
```

"Rooms" and "Housekeeping" will be combined as `housekeeping` since room supplies and cleaning supplies overlap.

### 9. UI Layout

The department selector will be a row of pill buttons above the existing Stock/Usage Log tabs:

```text
[All] [Kitchen] [Bar] [Gardens] [Housekeeping]
─────────────────────────────────────────────
[Stock] [Usage Log]
... existing content filtered by department ...
```

A "Transfer Stock" button will appear next to "Add Ingredient" when a specific department is selected.

