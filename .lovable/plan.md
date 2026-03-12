

## Fix: Room Occupancy Detection from Active Bookings

### Problem
Wendy has an active booking for Double Room #2 (Mar 9-13), but the `units.status` field is `ready` instead of `occupied`. This causes:
1. Room shows as "Ready" in the Walk-In/Sell section instead of occupied
2. Wendy doesn't appear in "Current Guests" on the reception page
3. Wendy doesn't appear in "Current Guests" on the OrderType page for staff ordering
4. The calendar shows her booking correctly (it reads from `resort_ops_bookings`, not `units.status`)

The `units.status` field is a mutable flag that easily gets out of sync — housekeeping completion, reservation deletion, or other flows can reset it to `ready` even when there's still an active booking.

### Solution: Hybrid Status with Booking-Based Fallback

Instead of relying solely on `units.status`, derive the effective status by cross-referencing active bookings. If `units.status` is `ready` but there's an active booking (`check_in <= today && check_out > today`), treat the unit as `occupied`.

#### 1. `src/pages/ReceptionPage.tsx` — Fix `getUnitStatus` to check bookings

Replace the simple status lookup with a function that also checks for active bookings:

```typescript
const getUnitStatus = (unit: any): 'occupied' | 'to_clean' | 'ready' => {
  const raw = (unit as any).status || 'ready';
  if (raw === 'occupied') return 'occupied';
  if (raw === 'to_clean') return 'to_clean';
  // Fallback: check if there's an active booking for this unit
  const resortUnit = resolveResortUnit(unit.name);
  if (resortUnit) {
    const hasActiveBooking = bookings.some((b: any) =>
      b.unit_id === resortUnit.id && b.check_in <= today && b.check_out > today
    );
    if (hasActiveBooking) return 'occupied';
  }
  return 'ready';
};
```

Also fix `getActiveBooking` to remove the status gate — it should find the booking regardless since `getUnitStatus` now handles the logic:

```typescript
const getActiveBooking = (unit: any) => {
  const resortUnit = resolveResortUnit(unit.name);
  if (!resortUnit) return null;
  return bookings.find((b: any) =>
    b.unit_id === resortUnit.id && b.check_in <= today && b.check_out > today
  ) || null;
};
```

This single change cascades through all downstream logic: `occupiedUnits`, `readyUnits`, `trulyAvailableUnits`, `todayDepartures`, etc.

#### 2. Auto-heal: Sync `units.status` when mismatch detected

Add a one-time effect that detects mismatched units (booking-occupied but status=ready) and fixes them in the DB:

```typescript
useEffect(() => {
  units.forEach(unit => {
    if (unit.status === 'ready') {
      const ru = resolveResortUnit(unit.name);
      if (ru && bookings.some(b => b.unit_id === ru.id && b.check_in <= today && b.check_out > today)) {
        supabase.from('units').update({ status: 'occupied' }).eq('id', unit.id);
      }
    }
  });
}, [units, bookings, resortUnits]);
```

#### 3. `src/pages/OrderType.tsx` — Fix "Current Guests" to use bookings

The current logic filters on `units.status === 'occupied'`. Change it to also include units with active bookings:

```typescript
// Instead of only occupied units, also check for active bookings
const occupiedUnits = (units || []).filter(u => {
  if (u.status === 'occupied') return true;
  const opsUnit = opsUnits?.find(ou => ou.name.toLowerCase().trim() === u.unit_name.toLowerCase().trim());
  return opsUnit && bookings?.some(b => b.unit_id === opsUnit.id);
});
```

### Files to Edit

| File | Change |
|------|--------|
| `src/pages/ReceptionPage.tsx` | Fix `getUnitStatus` with booking fallback; fix `getActiveBooking`; add auto-heal effect |
| `src/pages/OrderType.tsx` | Fix "Current Guests" to use booking-based occupancy detection |

