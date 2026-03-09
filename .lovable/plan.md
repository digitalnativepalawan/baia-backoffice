

## Fix: DineIn Orders Missing from Guest Portal + Missing Guest Name

### Problem

Two issues visible in the screenshots:

1. **Guest Portal only shows the Mango Daiquiri order** — the two DineIn orders for Double Room #3 are missing from "My Orders" and "My Bill"
2. **Service board cards don't show who ordered** — DineIn orders have blank `guest_name`

### Root Cause

In `CartDrawer.tsx` line 278: `room_id: roomUnit?.id || null` — `roomUnit` is only set when `selectedOrderType === 'Room'`. For DineIn orders to Double Room #3, `room_id` stays `null` even though the location is a room.

Similarly, `guest_name` is only populated when the order flow captures it (Room orders with Charge to Room). DineIn orders placed by staff don't look up the guest.

The Guest Portal queries `orders WHERE room_id = session.room_id`, so DineIn orders with `null` room_id are invisible.

### Fix

**`src/components/CartDrawer.tsx` — order insert logic**

- When `selectedOrderType` is DineIn (or any type) and `selectedLocation` matches a unit name, set `room_id` to that unit's ID. Change the roomUnit lookup from:
  ```typescript
  const roomUnit = selectedOrderType === 'Room' ? units?.find(...) : null;
  ```
  to:
  ```typescript
  const roomUnit = units?.find(u => u.unit_name === selectedLocation) || null;
  ```
  This ensures any order placed against a room location gets the `room_id` set regardless of order type.

- When `room_id` is being set and `guest_name` is empty, look up the active booking's guest name from `resort_ops_bookings` + `resort_ops_guests` for that unit and auto-populate `guest_name`.

**`src/components/service/ServiceOrderCard.tsx` — guest name display**

- Already shows `order.guest_name` when present (line 115-117). No change needed — fixing the data source fixes the display.

**`src/pages/GuestPortal.tsx` — orders query fallback**

- Add a secondary query for orders where `room_id IS NULL` but `location_detail` matches `session.room_name`, so historical orders placed before this fix also appear. Merge and deduplicate with the primary query.

### Files Changed

```
EDIT  src/components/CartDrawer.tsx       — Always set room_id when location matches a unit; auto-populate guest_name from active booking
EDIT  src/pages/GuestPortal.tsx           — Fallback query matching location_detail for orders with null room_id
```

No database changes needed.

