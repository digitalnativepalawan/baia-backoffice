

# Remove Guests Management Card from Resort Ops

## What's Changing

Remove the standalone "Guests" card (the list you see in the screenshot with edit/delete buttons) from the admin Resort Ops dashboard. Guest names already appear in the Reservations ledger, so this card is redundant.

## What Stays

- The `resort_ops_guests` table stays in the database -- it's still used by reservations and the Sirvoy webhook to link bookings to guests.
- The guest dropdown in the "Add Booking" form stays so you can assign guests to reservations.
- The `guestMap` lookup stays so reservation cards can display guest names.
- CSV import for reservations continues to auto-create guests as needed.

## Changes

### ResortOpsDashboard.tsx

1. **Remove the Guests card UI** (lines 743-777) -- the entire Card component with the guest list, edit forms, add form, and Add Guest button.

2. **Remove guest-only state variables and functions**:
   - `newGuest` state and `setNewGuest`
   - `editingGuest` state and `setEditingGuest`
   - `addGuest()` function
   - `saveGuest()` function

3. **Keep** the `guests` query, `guestMap`, and guest dropdown in booking forms -- these are needed for reservations.

### No database changes

The `resort_ops_guests` table remains unchanged. It is actively used by the booking system and webhook integration. No data will be deleted.
