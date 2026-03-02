

## Seed Housekeeping Data for All Room Types

### Problem
The Housekeeping Config UI has all the admin functions built, but the database has zero data in:
- `housekeeping_checklists` (empty)
- `cleaning_packages` (empty)
- `cleaning_package_items` (empty)
- `ingredients` table has only food items -- no cleaning supplies or amenities

Additionally, the 4 entries in `room_types` are named like units ("Deluxe Suite #1", "Double Room #1") instead of generic types ("Deluxe Suite", "Standard Double").

### Step 1: Fix Room Type Names
Rename the existing room types to proper generic names:
- "Deluxe Suite #1" --> "Deluxe Suite"
- "Double Room #1" --> "Standard Double"
- Delete "Double Room #2" and "Double Room #3" (they should share the "Standard Double" type)

Update `units` table so all 3 double room units point to the single "Standard Double" room type.

### Step 2: Add Cleaning Supply and Amenity Ingredients (14 new rows)

**Cleaning Supplies** (unit: grams):
- All-purpose cleaner, Glass cleaner, Bathroom cleaner, Floor cleaner, Bleach/Clorox, Dish soap

**Amenities** (unit: pcs):
- Shampoo, Conditioner, Body wash, Lotion, Hand soap, Toilet paper, Tissues, Trash bags

### Step 3: Insert Checklist Items for Both Room Types

**Common items (both types):**

| Item | Required | Count |
|------|----------|-------|
| Bed - Condition | Yes | -- |
| Pillows | Yes | 4 (Suite: 6) |
| Bed Linens - No stains | Yes | -- |
| TV - Working | Yes | -- |
| Remote Controls | No | 2 |
| AC - Working | Yes | -- |
| Towels - Bath | Yes | 2 (Suite: 4) |
| Towels - Hand | Yes | 2 (Suite: 4) |
| Bathroom - Clean | Yes | -- |
| Mini Bar | Yes | -- |
| Lights - Working | Yes | -- |
| Floor - Clean | Yes | -- |
| Trash Emptied | Yes | -- |
| Windows - Clean | Yes | -- |

### Step 4: Create "Regular Clean" Package for Each Room Type

Map each new cleaning/amenity ingredient with default quantities:

| Supply | Standard Double | Deluxe Suite |
|--------|----------------|--------------|
| All-purpose cleaner | 40g | 80g |
| Glass cleaner | 10g | 30g |
| Bathroom cleaner | 50g | 120g |
| Floor cleaner | 60g | 150g |
| Bleach/Clorox | 20g | 60g |
| Dish soap | 15g | 20g |
| Shampoo | 2 | 4 |
| Conditioner | 2 | 4 |
| Body wash | 2 | 4 |
| Lotion | 1 | 2 |
| Hand soap | 1 | 2 |
| Toilet paper | 2 | 3 |
| Tissues | 1 | 1 |
| Trash bags | 1 | 2 |

### What Gets Executed
- Data INSERT operations (not migrations) for ingredients, checklists, packages, and package items
- Data UPDATE for room type names and unit assignments
- Data DELETE for duplicate room types
- No schema changes needed
- No code changes needed -- the existing UI will display everything automatically

