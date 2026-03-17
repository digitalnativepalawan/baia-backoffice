
Goal: make Reception, Guest Portal, and Housekeeping follow one consistent resort workflow:
- Same-day arrivals = “arriving today / not yet occupied” until Reception performs check-in
- Same-day departures = still “in-house / occupied” until Reception performs checkout
- After checkout = room moves to `to_clean`, Housekeeping completes cleaning, then room returns to `ready`

What I found
1. The importer is likely the main source of the confusion:
- `ImportReservationsModal.tsx` currently sets display room status to `occupied` whenever an imported booking is active today (`check_in <= today < check_out`)
- For a same-day arrival, that marks the room occupied before the guest has actually arrived

2. The app currently uses inconsistent “active booking” rules:
- `ReceptionPage.tsx` uses `check_in <= today && check_out > today`
- `RoomsDashboard.tsx` uses `check_in <= today && check_out >= today`
- That mismatch makes same-day departures behave differently across screens

3. Checkout flow already exists and is mostly correct:
- `CheckoutModal.tsx` updates the booking checkout date to today
- sets room status to `to_clean`
- transitions housekeeping into cleaning
- Guest Portal already supports bill agreement via `bill_agreed_at`
- Housekeeping already finishes the room lifecycle after cleaning

Why the display feels wrong
- Newly imported bookings are pre-marking units as occupied
- Reception is supposed to distinguish:
  - arriving today but not checked in yet
  - occupied/in-house
  - checking out today
  - to clean
- Right now imported room-status sync collapses those states too early

Implementation plan
1. Fix import side effects
- Update `ImportReservationsModal.tsx` so importing a same-day reservation does not auto-set the display room to `occupied`
- Imported rooms should stay `ready` unless there is evidence the guest is already checked in
- Keep room/unit auto-creation and booking import intact

2. Define one shared occupancy rule
- Standardize all room/booking logic around:
  - Arrival today before check-in: not occupied
  - In-house: occupied until checkout action is completed
  - After checkout: `to_clean`
  - After housekeeping completion: `ready`
- Align `ReceptionPage.tsx`, `RoomsDashboard.tsx`, and briefing logic to that same rule

3. Correct Reception summaries
- In `ReceptionPage.tsx`:
  - Today arrivals should show reservations with `check_in === today` and room not occupied
  - Today departures should show occupied guests whose booking is scheduled to leave today
  - To clean should only be rooms already checked out and handed to housekeeping
- Prevent same-day arrivals from appearing as occupied just because they were imported

4. Correct Morning Briefing
- In `MorningBriefing.tsx`:
  - “Arrivals today” should mean upcoming arrivals, not occupied guests
  - “Departures today” should mean in-house guests still awaiting checkout
  - “Rooms to clean” should only reflect post-checkout housekeeping states

5. Keep checkout flow as the trigger point
- Preserve existing checkout behavior in `CheckoutModal.tsx`
- Treat Reception checkout as the moment that:
  - ends in-house stay
  - moves room to `to_clean`
  - starts housekeeping phase
- Keep Guest Portal bill agreement as a pre-checkout step, not a checkout substitute

6. Verify Housekeeping handoff
- Confirm `HousekeeperPage.tsx` continues to show only post-checkout cleaning work
- No changes to the established inspection/cleaning lifecycle unless needed for the unified status model

Files to update
- `src/components/admin/ImportReservationsModal.tsx`
- `src/pages/ReceptionPage.tsx`
- `src/components/MorningBriefing.tsx`
- `src/components/admin/RoomsDashboard.tsx`
- Possibly small compatibility adjustments in `src/components/rooms/CheckoutModal.tsx`

Expected result
- Nadine / Peggy Lu / Karlijn-style arrivals for today will show as arrivals, not occupied
- Guests checking out today will remain occupied/in-house until staff completes checkout
- Once checkout is done, the room moves into housekeeping exactly as already designed
- Reception, Guest Portal, and Housekeeping will all reflect the same operational state model instead of conflicting date interpretations
