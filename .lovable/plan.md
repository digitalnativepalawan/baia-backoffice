
Goal: make the Rooms section fully usable end-to-end so staff can check in a guest from a room, then immediately use Docs, Tours, Notes, and Vibe without needing hidden setup steps.

What I found (root causes)
1) Rooms are loaded from the `units` table (has data), but occupancy/docs/tours depend on active records in `resort_ops_bookings` + `resort_ops_guests` (both currently empty in your backend), so every room appears “Vacant.”
2) There is no “Check-In Guest” action inside `RoomsDashboard`, so users cannot create the guest/booking context needed for Docs and Tours from the Rooms flow.
3) `resort_ops_units` is a separate unit system used by bookings; current setup is mainly maintained in `units`, causing mapping drift.
4) Reservation import has hardcoded unit validation (`G1/G2/G3`), which does not match your current room names (e.g., Deluxe Suite #1), so import setup can silently block usage.
5) Sirvoy webhook uses hardcoded room->unit IDs/names, so real-world room mappings are fragile.

Implementation approach
Phase 1 — Make Rooms immediately functional (primary fix)
A) Add in-room Guest Check-In flow in `src/components/admin/RoomsDashboard.tsx`
- In the Guest tab, when room is vacant, show a clear check-in form:
  - Guest full name (required)
  - Optional phone/email
  - Check-in date (default today)
  - Check-out date (required)
  - Adults, platform, room rate (optional defaults)
- Submit behavior:
  1. Create/find guest in `resort_ops_guests`
  2. Resolve/create corresponding unit in `resort_ops_units` by room name
  3. Insert booking in `resort_ops_bookings` with that `unit_id`
  4. Refresh room queries and switch UI to occupied state
- Result: Docs/Tours become enabled immediately after check-in.

B) Add in-room Checkout action
- For occupied rooms, add “Check Out Guest” button.
- On checkout, set booking checkout date to today (or explicit selected date).
- Optional: if there is an active vibe record, prompt to mark it checked out (non-blocking).

C) Improve empty states and setup guidance in Rooms
- Replace generic “No guest checked in” text with actionable guidance:
  - “Check in guest to enable Docs and Tours”
  - CTA button: “Check In Guest”
- For Docs/Tours tabs, keep disabled/helpful state until guest context exists.

Phase 2 — Remove setup friction from integrations
D) Fix reservation import validation in `src/components/admin/ImportReservationsModal.tsx`
- Remove hardcoded `VALID_UNITS`.
- Validate against actual units passed from backend (case-insensitive match).
- Keep detailed row-level errors, but aligned to your real room names.

E) Harden webhook room mapping in `supabase/functions/sirvoy-webhook/index.ts`
- Replace hardcoded `ROOM_NAME_TO_UNIT` IDs with dynamic resolution:
  - normalize incoming room name
  - find matching `resort_ops_units` by name
  - if missing, create it (or fallback strategy) before inserting booking
- Keep existing create/update/cancel booking behavior, but remove brittle static IDs.

Phase 3 — Keep unit systems consistent
F) Data consistency/backfill migration
- Add a migration to backfill `resort_ops_units` from existing `units` names where missing.
- Add a uniqueness guard on normalized unit names in `resort_ops_units` to avoid duplicates.
- This keeps Rooms occupancy logic stable even if setup happens in different admin areas.

Files to update
1) `src/components/admin/RoomsDashboard.tsx`
- Add check-in form UI + submit handler
- Add checkout action
- Add clearer empty states
- Adjust booking lookup to use mapped resort unit per selected room name

2) `src/components/admin/ImportReservationsModal.tsx`
- Replace hardcoded unit validation with dynamic unit list matching

3) `supabase/functions/sirvoy-webhook/index.ts`
- Replace static unit ID map with dynamic unit resolution/create flow

4) `supabase/migrations/<new_timestamp>_sync_units_for_rooms.sql`
- Backfill and guardrails for `resort_ops_units`

Validation plan
1) Data setup test
- Open Rooms → select vacant room → check in guest.
- Confirm status changes to Occupied immediately.

2) Functional room flow test
- In same room:
  - Upload document in Docs tab
  - Add tour in Tours tab
  - Add note in Notes tab
  - Create/update vibe in Vibe tab
- Confirm records persist and re-open correctly.

3) Integration sanity
- Import a CSV using current real room names.
- Run webhook test payload using a non-hardcoded room name and verify booking is created/mapped.

4) Mobile usability
- Verify all key actions (Check-In, Upload, Add Tour, Save Vibe) use touch-safe targets and are operable end-to-end on mobile viewport.

Risks and handling
- Duplicate unit names with different casing: handled via normalized matching + uniqueness guard.
- Existing bookings with null/unknown unit IDs: Rooms should still remain usable after first check-in due to name-based resolution and future consistent inserts.
- Partial failures during check-in (guest created but booking failed): show explicit error toast and prevent false occupied UI until booking insert succeeds.
