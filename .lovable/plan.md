
# Guest Portal: Staff Documentation and Improved Scooter/Tour Booking

## Problem
1. All guest portal bookings (tours, transport, rentals, requests, reviews) currently record `staff_name: 'Guest Portal'` -- there is no staff accountability or confirmation step.
2. Scooter rentals are a simple one-tap book with no duration/date selection.
3. Tour bookings lack pickup time and notes fields.

## Plan

### 1. Add `confirmed_by` column to relevant tables
Add a `confirmed_by` (text) column to `tour_bookings` and `guest_requests` tables so every portal action can be traced to a staff member. The `room_transactions` table already has `staff_name`.

Migration:
```sql
ALTER TABLE tour_bookings ADD COLUMN confirmed_by text NOT NULL DEFAULT '';
ALTER TABLE tour_bookings ADD COLUMN notes text NOT NULL DEFAULT '';
ALTER TABLE guest_requests ADD COLUMN confirmed_by text NOT NULL DEFAULT '';
ALTER TABLE guest_reviews ADD COLUMN confirmed_by text NOT NULL DEFAULT '';
```

### 2. Change portal bookings to "pending" requests (not instant charges)
Instead of guests self-booking and auto-charging, all portal actions (tours, transport, rentals) will create a **pending request** that staff must confirm. The room charge only happens when staff confirms.

**Guest Portal changes (`src/pages/GuestPortal.tsx`):**

- **Tours**: Guest selects tour, date, pax, and optional notes. Submits as a pending `tour_bookings` record (status = 'pending'). No room charge yet.
- **Transport**: Guest selects route, date, time. Submits as a pending `guest_requests` record (type = 'Transport'). No room charge yet.
- **Rentals (Scooter)**: Improve the UI significantly:
  - Add rental duration selection: "Half Day (8AM-1PM)", "Full Day (8AM-6PM)", "24 Hours", "Multi-Day"
  - Add start date picker
  - Add number of days field (shown for Multi-Day)
  - Add notes/preferences field (e.g., "automatic preferred")
  - Submits as pending `guest_requests` record. No room charge yet.

### 3. Staff confirmation in Admin Activity tab (`src/components/admin/GuestPortalConfig.tsx`)

**Activity tab enhancements:**

- **Tour Bookings**: Add "Confirm" and "Cancel" buttons to pending bookings. On confirm, staff name is recorded in `confirmed_by` and room charge is created via `room_transactions`. Status updates to 'confirmed'.
- **Guest Requests (Transport/Rentals)**: The existing Accept/Complete flow will be enhanced. On "Accept", the staff member's name is recorded in `confirmed_by` and the room charge is created. Staff name is pulled from the admin login session (localStorage `staff_name`).
- **Guest Reviews**: Add a "Reviewed by" acknowledgment button.

### 4. Improved Tour Booking UI (Guest Portal)

Current: Select tour card, pick date and pax, book.

Enhanced:
- Add **pickup time** field (text input, e.g. "7:00 AM")
- Add **special requests/notes** textarea (e.g., "Vegetarian lunch", "Need snorkel gear")
- Show tour details more clearly: included items, what to bring
- Confirmation shows "Your booking request has been submitted. Staff will confirm shortly."

### 5. Improved Scooter/Rental UI (Guest Portal)

Current: One-tap instant charge with no options.

Enhanced:
- **Item type cards** with icons (Scooter, Bicycle, Kayak, etc.)
- **Duration selector**: Radio group with options pulled from `rental_rates` (Half Day, Full Day, 24hrs, etc.)
- **Start date** picker
- **Number of units** (default 1)
- **Notes** field for preferences
- Total price calculated dynamically
- Submit creates a pending request, not an instant charge

### 6. Staff name tracking

The admin session already stores the logged-in staff name. All confirmation actions will use this to populate:
- `confirmed_by` on `tour_bookings` and `guest_requests`
- `staff_name` on `room_transactions` (replacing 'Guest Portal')

---

## Technical Summary

| File | Changes |
|---|---|
| Database migration | Add `confirmed_by` and `notes` columns to `tour_bookings`, `guest_requests`, `guest_reviews` |
| `src/pages/GuestPortal.tsx` | Refactor Tours, Rentals, Transport views to submit as pending (no auto-charge). Add duration/date/notes to rentals. Add pickup time/notes to tours. |
| `src/components/admin/GuestPortalConfig.tsx` | Add staff confirm/cancel flow to Activity tab for tours, transport, rentals. On confirm: record staff name, create room charge. |

All portal actions become: Guest requests -> Staff confirms (with name logged) -> Room charged.
