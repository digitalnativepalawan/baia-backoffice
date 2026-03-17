
Goal: make all reception-facing screens show March 17 correctly using existing check-in / checkout workflow logic, without auto-changing saved room data yet.

What I found
- The wrong display is real in the database: `units.status` is currently `occupied` for `COT(1)`, `COT(2)`, `COT(3)`, and `SUI(1)`.
- The bookings themselves are correct for today:
  - Departures today: Karoline Ziemons, Mick Dziggel, Piotr Wasilewski, Thierry TRILLARD
  - Arrivals today: Karlijn van den Broek, Nadine Closset, Peggy Lu, Thierry MARCEL... TRILLARD
- The main bug is display precedence:
  - `ReceptionPage.tsx`, `RoomsDashboard.tsx`, and `MorningBriefing.tsx` treat raw `units.status === 'occupied'` as final.
  - That makes same-day arrivals appear occupied whenever old room state is stale.
- The existing shared helper only supports “derive occupied from booking dates,” but not “which booking should drive the room today when there is both a departure and an arrival on the same room.”

User decision captured
- Use a display-only fix.
- Do not auto-correct saved room statuses yet.

Implementation approach
1. Expand the shared occupancy model in `src/lib/receptionOccupancy.ts`
- Add helpers for today’s room workflow:
  - identify same-day departure booking for a unit
  - identify same-day arrival booking for a unit
  - determine whether a room should display as:
    - departure pending
    - ready for check-in
    - occupied
    - to_clean
- Keep Manila date handling centralized.

2. Fix Reception dashboard logic in `src/pages/ReceptionPage.tsx`
- Replace current `getUnitStatus` / `getActiveBooking` display logic with booking-aware precedence:
  - `to_clean` always wins if housekeeping phase started
  - if a room has a departure today still in-house, show that departure workflow
  - if a room also has an arrival today, do not let raw `occupied` status hide that arrival
  - only show occupied when there is an actual in-house stay, not just stale unit status
- Update:
  - Today Arrivals list
  - Today Departures list
  - protected “Reserved for arrival” room cards
  - occupancy counts
- Remove or narrow the auto-heal effect that can push rooms back to occupied from old/stale status.

3. Fix Morning Briefing in `src/components/MorningBriefing.tsx`
- Use the same room-level resolution as Reception:
  - arrivals today = guests checking in today who are not yet checked in
  - departures today = guests due out today who are still in-house
  - occupied count = only true in-house rooms, not stale same-day arrival rooms
- Ensure ops tasks say:
  - “Checkout pending” for departures
  - “Prepare for arrival” / ready-for-check-in for arrivals

4. Fix Back Office/Admin room display in `src/components/admin/RoomsDashboard.tsx`
- Stop showing a room card as occupied just because `units.status` says occupied.
- Use the same shared room-resolution logic so rooms like:
  - COT(2) show Karoline as departure pending and Karlijn as arrival today
  - COT(3) show Mick as departure pending and Nadine as arrival today
  - SUI(1) show Piotr as departure pending and Peggy as arrival today
- Keep checkout action flow unchanged:
  - checkout => `to_clean`
  - housekeeping => `ready`
  - arrival stays ready until actual check-in

5. Preserve extension / review handling
- Thierry TRILLARD with old departure on `COT(1)` should not be treated as a normal checkout if the stay is effectively extended by a new linked arrival record.
- Since the user explicitly wants “possible duplicate / flag for review,” I’ll plan to surface that as a review state in display logic rather than merging data automatically.

Expected result after implementation
- Peggy Lu, Nadine Closset, and Karlijn van den Broek will no longer appear as occupied before check-in.
- Reception, Service Reception, Staff briefing, and Admin/Back Office will all agree on:
  - departures pending today
  - arrivals ready for check-in today
  - occupied only for actual in-house guests
  - housekeeping only after checkout
- Existing check-in/checkout workflows remain the trigger for status transitions.

Technical notes
- No backend schema change is needed for this pass.
- This is a UI/state-resolution fix across existing queries and shared helpers.
- The safest implementation is to create one shared “display state resolver” and consume it in all three places rather than patching each screen independently.
