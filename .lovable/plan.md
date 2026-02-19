

# Preload Ingredient Cost Data and Finalize Production System

## Current State

The inventory + recipe deduction + stock check system is **already fully implemented** in code:
- `stockCheck.ts` -- checks stock before ordering, shows sold-out/low-stock badges
- `CartDrawer.tsx` -- pre-order validation with override option
- `MenuPage.tsx` -- sold-out/low-stock badges on menu items
- `inventoryDeduction.ts` -- deducts at "Preparing" status
- `InventoryDashboard.tsx` -- consumption logs, filters, value summary
- `AdminPage.tsx` -- food cost and margin % display per dish

**The problem**: All 66 ingredients have `cost_per_unit = 0`, making food costing, margin calculations, and inventory value all show zero.

## What This Plan Does

### Step 1: Update Ingredient Cost Data (Database Updates)

Bulk update `cost_per_unit` for all ingredients using the Manila baseline prices provided:

| Ingredient | Unit | Cost/Unit |
|---|---|---|
| Eggs | pcs | 8.00 |
| Bread | slices | 4.00 |
| Rice | grams | 0.06 |
| Corned Beef | grams | 0.22 |
| Shrimp | grams | 0.48 |
| Tuna | grams | 0.52 |
| Spanish Mackerel | grams | 0.38 |
| Chicken | grams | 0.24 |
| Pork Cutlet | grams | 0.32 |
| Mixed Seafood | grams | 0.45 |
| Linguine/Paccheri/Tagliatelle/Rice Noodles Pasta | grams | 0.14 |
| Flour | grams | 0.055 |
| Milk | ml | 0.09 |
| Butter | grams | 0.42 |
| Olive Oil | ml | 0.65 |
| Cooking Oil | ml | 0.18 |
| White Rum | ml | 0.60 |
| Coffee Beans | grams | 0.90 |
| Italian Cheese Blend | grams | 0.90 |
| Parmesan Cheese | grams | 1.20 |
| Pecorino Cheese | grams | 1.40 |
| Mascarpone | grams | 1.00 |
| Yogurt | grams | 0.18 |
| Granola | grams | 0.48 |
| Honey | ml | 0.42 |
| Maple Syrup | ml | 0.90 |
| Sugar | grams | 0.075 |
| Tomato | grams | 0.09 |
| Onion | grams | 0.07 |
| Garlic | grams | 0.20 |
| Chili | grams | 0.18 |
| Bell Pepper | grams | 0.22 |
| Basil | grams | 1.00 |
| Mint Leaves | grams | 1.00 |
| Lemon / Calamansi | ml | 0.12 |
| Soda Water | ml | 0.06 |
| Whipped Cream | grams | 0.55 |
| Chocolate Chips | grams | 0.48 |
| Peanuts | grams | 0.18 |
| Capers | grams | 1.10 |
| Olives | grams | 0.65 |
| Tomato Marinara Sauce | grams | 0.18 |
| Tamarind Sauce | grams | 0.20 |
| Aioli | grams | 0.35 |
| Wasabi Mayo | grams | 0.35 |
| Hollandaise Sauce | grams | 0.35 |
| Cream | ml | 0.09 |
| Banana | grams | 0.08 |
| Potato | grams | 0.05 |
| Chorizo | grams | 0.40 |
| Watermelon | grams | 0.04 |
| Mango | grams | 0.08 |
| Pineapple | grams | 0.06 |
| Fresh Fruits | grams | 0.08 |
| Coconut | grams | 0.06 |
| Cocoa Powder | grams | 0.30 |
| Bean Sprouts | grams | 0.05 |
| Eggplant | grams | 0.06 |
| Cilantro | grams | 0.80 |
| Soy Sauce | ml | 0.10 |
| Fish Sauce | ml | 0.08 |
| Vinegar | ml | 0.05 |
| Curry Sauce | grams | 0.20 |
| Cured Pork / Guanciale | grams | 0.80 |

This is approximately 64 UPDATE statements, executed via the data insert tool (not migration).

### Step 2: Update Menu Item Food Costs

Using the benchmark table provided, update each menu item's `food_cost` field so margin % displays correctly in the admin panel. This uses the actual target food cost derived from the benchmark margins:

For each dish: `food_cost = price * (1 - margin/100)`

Example: Corned Beef with Eggs = 118 * (1 - 0.66) = ~40

### Step 3: No Code Changes Needed

All the code for stock checking, badges, cart validation, deduction, consumption logs, and food cost display is already implemented and working. Once the data is populated, everything will activate automatically:

- Inventory Dashboard will show real inventory value
- "No Cost" badges will disappear from ingredients
- "No cost data" warnings will disappear from menu items
- Food cost and margin % will display correctly per dish
- The "missing cost" alert banner will go away

## Result

After these data updates, the system will be production-ready with:
- Real-time stock availability on menu (Available / Low Stock / Sold Out)
- Pre-order stock validation in cart with admin override
- Automatic deduction at "Preparing" status
- Accurate food cost and margin % per dish
- Inventory value tracking
- Consumption logs and usage reports

