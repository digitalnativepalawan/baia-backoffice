

## Plan: Change CSV Template Column from "Total Amount Projected" to "Price Per Night"

### Analysis

The `room_rate` field in `resort_ops_bookings` is already used as a **per-night rate** throughout the entire app (ReceptionPage shows `₱X/night`, CheckoutModal calculates `nights × room_rate`, etc.). The current CSV import incorrectly labels this as "Total Amount Projected" and then divides it by number of units — but it should just be the nightly rate stored directly.

### Changes — Single File

**`src/components/admin/ImportReservationsModal.tsx`**

1. **Rename CSV header**: `Total Amount Projected` → `Price Per Night`
2. **Rename internal field**: `totalProjected` → `pricePerNight` (in the `ParsedRow` interface and all references)
3. **Update template example**: Change example value to reflect a per-night rate (e.g., `1500` instead of `5000`)
4. **Fix the insert logic**: Store `pricePerNight` directly as `room_rate` instead of splitting by unit count. Each unit booking gets the same nightly rate. The `paid_amount` (`paidRealized`) splitting by units can remain as-is since partial payment tracking per unit is still useful.
5. **Update the preview row display**: Show `₱X/night` instead of `Projected: ₱X`
6. **Update validation error message**: `totalProjected` → `pricePerNight` number check
7. **Update DialogDescription text** to mention the new column name

No other files affected — `room_rate` is already consumed as per-night everywhere else.

