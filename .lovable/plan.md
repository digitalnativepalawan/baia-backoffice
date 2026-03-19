

## Plan: Show Departing Guests in "Current Guests" Order Screen

### Problem
The "Current Guests" section on the Order Type page (`src/pages/OrderType.tsx`, line 58) queries bookings with `check_out > today` — this **excludes** guests checking out today. But those guests are still physically at the resort (checkout is typically before noon) and may want to order food/drinks before leaving.

### Fix: 1 file, ~15 lines changed

**`src/pages/OrderType.tsx`**

**Query change (line 58):**
- Change `.gt('check_out', today)` to `.gte('check_out', today)` so guests with `check_out = today` are included
- Add `.is('checked_out_at', null)` to exclude guests who have already completed checkout

**Display change (lines 132-157):**
- Add a visual indicator to distinguish departing guests (check_out = today) from in-house guests
- Departing guests get an **orange** dot + "Checking out" label instead of the blue dot
- In-house guests keep the existing blue dot

This ensures:
- At 7am, staff sees both departing and in-house guests for ordering
- Once a guest completes checkout (`checked_out_at` is set), they disappear from the list
- Staff can clearly see who is departing vs staying

### Data flow
```text
Query: check_in <= today AND check_out >= today AND checked_out_at IS NULL
  ├─ check_out > today  → blue dot (in-house)
  └─ check_out = today  → orange dot (departing)
```

No database changes needed.

