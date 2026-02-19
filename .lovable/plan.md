

# Add All Ingredients, Recipe Links, and "Used in X dishes" UI

## Overview

Insert all 67 ingredients into the database, create recipe_ingredient links connecting them to the 39 menu items, and enhance the Inventory Dashboard's edit dialog to show which dishes use each ingredient (as shown in the screenshot).

## Part 1: Insert 67 Ingredients (Database Data)

Insert all ingredients with their correct units. All start with cost_per_unit=0, current_stock=0, low_stock_threshold=200 (matching screenshot pattern).

```
Aioli (grams), Banana (grams), Basil (grams), Bean Sprouts (grams), Bell Pepper (grams),
Bread (slices), Butter (grams), Capers (grams), Chicken (grams), Chili (grams),
Chocolate Chips (grams), Chorizo (grams), Cilantro (grams), Cocoa Powder (grams),
Coconut (grams), Coffee Beans (grams), Cooking Oil (ml), Corned Beef (grams),
Cream (ml), Cured Pork / Guanciale (grams), Curry Sauce (grams), Eggplant (grams),
Eggs (pcs), Fish Sauce (ml), Flour (grams), Fresh Fruits (grams), Garlic (grams),
Granola (grams), Hollandaise Sauce (grams), Honey (ml), Italian Cheese Blend (grams),
Lemon / Calamansi (ml), Linguine Pasta (grams), Mango (grams), Maple Syrup (ml),
Mascarpone (grams), Milk (ml), Mint Leaves (grams), Mixed Seafood (grams),
Olive Oil (ml), Olives (grams), Onion (grams), Paccheri Pasta (grams),
Parmesan Cheese (grams), Peanuts (grams), Pecorino Cheese (grams), Pineapple (grams),
Pork Cutlet (grams), Potato (grams), Rice (grams), Rice Noodles (grams),
Shrimp (grams), Soda Water (ml), Soy Sauce (ml), Spanish Mackerel (grams),
Sugar (grams), Tagliatelle Pasta (grams), Tamarind Sauce (grams), Tomato (grams),
Tomato Marinara Sauce (grams), Tuna (grams), Vinegar (ml), Wasabi Mayo (grams),
Watermelon (grams), Whipped Cream (grams), White Rum (ml), Yogurt (grams)
```

## Part 2: Create Recipe Links (Database Data)

Link each ingredient to its relevant menu items with sensible default quantities. Here are the recipe assignments based on menu analysis:

**Breakfast items:**
- Cheese Omelette: Eggs, Butter, Italian Cheese Blend, Olive Oil
- Corned Beef with Eggs: Eggs, Corned Beef, Cooking Oil, Garlic, Onion, Rice
- Eggs Benedict: Eggs, Bread, Hollandaise Sauce, Butter
- French Toast: Bread, Eggs, Butter, Maple Syrup, Sugar
- Mix Fruit Platter: Fresh Fruits, Mango, Pineapple
- Pancakes (Fruit or Chocolate Chips): Flour, Eggs, Milk, Butter, Sugar, Maple Syrup, Chocolate Chips, Fresh Fruits
- Tropical Yogurt Bowl: Yogurt, Granola, Mango, Fresh Fruits, Honey

**Breakfast Drinks:**
- All coffee drinks: Coffee Beans, Sugar, Milk (where applicable)
- Mango / Watermelon Juice: Mango, Watermelon, Sugar

**Cocktails:**
- Banana Daiquiri: White Rum, Banana, Sugar, Lemon / Calamansi
- Basiliquito: White Rum, Basil, Sugar, Lemon / Calamansi, Soda Water
- Mango Daiquiri: White Rum, Mango, Sugar, Lemon / Calamansi
- Mojito: White Rum, Mint Leaves, Sugar, Lemon / Calamansi, Soda Water
- Tropical Daiquiri: White Rum, Banana, Mango, Sugar, Lemon / Calamansi

**Starters:**
- Bruschetta: Bread, Tomato, Garlic, Olive Oil, Basil
- Ceviche: Spanish Mackerel, Lemon / Calamansi, Onion, Cilantro, Chili
- Chorizo Croquettes with Aioli: Chorizo, Flour, Eggs, Aioli, Potato, Cooking Oil
- Papas Bravas: Potato, Aioli, Tomato, Olive Oil, Garlic, Chili
- Prawns Asian Salad: Shrimp, Bean Sprouts, Chili, Peanuts, Fish Sauce, Cilantro, Lemon / Calamansi
- Shrimp Tempura with Wasabi Mayo: Shrimp, Flour, Eggs, Wasabi Mayo, Cooking Oil
- Spanish Mackerel Carpaccio: Spanish Mackerel, Olive Oil, Lemon / Calamansi, Capers, Chili
- Tuna Tartare in Watermelon Gazpacho: Tuna, Watermelon, Olive Oil, Lemon / Calamansi, Chili

**Main Courses:**
- Chicken Cacciatore: Chicken, Tomato, Olive Oil, Garlic, Onion, Bell Pepper, Cooking Oil
- Mojo Verde Fillet: Spanish Mackerel, Garlic, Olive Oil, Cilantro, Lemon / Calamansi
- Seafood Salad: Mixed Seafood, Olive Oil, Lemon / Calamansi, Garlic, Olives
- Shrimps a la Pobre: Shrimp, Garlic, Olive Oil, Chili, Lemon / Calamansi, Eggs
- Shrimps Pad Thai: Shrimp, Rice Noodles, Eggs, Cooking Oil, Soy Sauce, Tamarind Sauce, Peanuts (wait - no peanuts listed for pad thai... but it's typical), Sugar, Lemon / Calamansi
- Tonkatsu Pork Curry: Pork Cutlet, Flour, Eggs, Curry Sauce, Rice, Cooking Oil
- Valvania Fillet: Spanish Mackerel (or similar fish), Olive Oil, Eggplant, Tomato, Garlic

**Pasta:**
- Linguine Aglio Olio e Peperoncino: Linguine Pasta, Garlic, Olive Oil, Chili
- Paccheri Carbonara: Paccheri Pasta, Cured Pork / Guanciale, Eggs, Pecorino Cheese, Parmesan Cheese
- Shrimps Marinara Linguine: Linguine Pasta, Shrimp, Tomato Marinara Sauce, Garlic, Olive Oil
- Tagliatelle Amatriciana: Tagliatelle Pasta, Cured Pork / Guanciale, Tomato, Pecorino Cheese, Onion
- Tagliatelle Puttanesca: Tagliatelle Pasta, Tomato Marinara Sauce, Olives, Capers, Garlic, Olive Oil

**Desserts:**
- Fruit Platter: Fresh Fruits, Mango, Whipped Cream
- Tiramisu: Mascarpone, Eggs, Coffee Beans, Cocoa Powder, Sugar, Whipped Cream, Coconut

## Part 3: UI Enhancement -- "Used in X dishes" in Edit Dialog

Update `InventoryDashboard.tsx` to:

1. **Fetch recipe data**: Add a query for `recipe_ingredients` with joined `menu_items` data
2. **Show dish count on ingredient cards**: Display "X dishes" next to each ingredient in the list (like the screenshot shows)
3. **Show "Used in X dishes" section in the edit dialog**: When editing an ingredient, display a panel showing which menu items use it and the quantity per order

### Changes to InventoryDashboard.tsx:

- Add query: `recipe_ingredients` joined with `menu_items` to get dish names and quantities
- In the ingredient list cards: add a small text showing dish count (e.g., "2 dishes")
- In the edit dialog: add a "Used in X dishes" section below the form fields showing each dish name and quantity per order
- Add the `slices` unit to the UNITS array (currently missing, needed for Bread)

### No database schema changes needed
All tables already exist with the correct columns.

