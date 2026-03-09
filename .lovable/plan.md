

## Plan: Add "Week Ahead" Arrivals & Departures to Rooms Section

### Problem
Bulk-imported reservations appear in Resort Ops but are invisible in the Rooms section (ReceptionPage) because:
- "Arrivals Today" only shows bookings with `check_in === today`
- Room cards only show occupied status after manual check-in
- There's no visibility into upcoming reservations for the week

### Solution
Add a **"This Week"** panel to ReceptionPage showing upcoming check-ins and check-outs for the next 7 days. The manual check-in flow remains unchanged — this is purely a visibility improvement.

### Changes — Single File

**`src/pages/ReceptionPage.tsx`**

1. **Add `addDays` import** from `date-fns`

2. **Compute "week ahead" bookings** (after the existing `todayArrivals` / `todayDepartures` logic):
   - `weekArrivals`: bookings where `check_in` is between tomorrow and +6 days, grouped/sorted by date
   - `weekDepartures`: bookings where `check_out` is between tomorrow and +6 days (for occupied rooms)

3. **Render a new "Upcoming This Week" section** after "Arrivals Today", before "Walk-In / Sell Room":
   - Collapsible section showing upcoming arrivals grouped by day (e.g., "Tue Mar 10 — 2 arrivals")
   - Each row shows: guest name, unit, platform, rate, pax
   - Today's arrivals keep their existing "Check In" button section as-is
   - Upcoming arrivals are read-only (no check-in button since guest hasn't arrived)
   - Also show upcoming departures for awareness

4. **Update summary counters** — add a 4th counter showing "Week Arrivals" count in the stats grid (change from 3-col to 4-col or add a second row)

5. **Enhance room cards for "Ready" rooms** — if a Ready room has a booking arriving within the next 7 days, show a subtle indicator on the room card: guest name + arrival date (e.g., "John Doe · Mar 11")

### What stays the same
- Manual check-in flow is untouched
- Room status only changes to `occupied` via the check-in action
- Resort Ops remains the import/webhook management section
- RoomsDashboard (admin room grid) gets the same upcoming booking indicators on Ready room cards

### Files
```
EDIT  src/pages/ReceptionPage.tsx
EDIT  src/components/admin/RoomsDashboard.tsx
```

No database changes needed — all data is already in `resort_ops_bookings`.

