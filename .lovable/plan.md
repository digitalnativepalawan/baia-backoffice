

## Plan: Make All Guest Services Editable with Proper Data Wiring

### Problem
Currently only `guest_tours` records are editable via `EditTourModal`. Tour bookings from the guest portal (`tour_bookings` table) and guest requests (`guest_requests` — transport, rentals, etc.) cannot be edited. Additionally, the `EditTourModal` only invalidates the room-detail query key, not the Experiences page queries.

### Changes

#### 1. Generalize `EditTourModal` to handle both `guest_tours` AND `tour_bookings`

Add a `sourceTable` prop (default `'guest_tours'`). When saving, update the correct table and invalidate all relevant query keys:
- `all-tours-experiences`
- `tour-bookings-experiences`
- `reception-tours-today`
- `reception-tour-bookings`
- `guest-tours` (room detail)

#### 2. Create `EditRequestModal` for guest requests (transport, rentals, etc.)

A new modal for editing `guest_requests` records with fields:
- Request type (text)
- Guest name (text)
- Details (textarea)
- Status display

On save, update `guest_requests` and invalidate `all-requests-experiences` + `recent-requests-history`.

#### 3. Wire up clickable editing in `ExperiencesPage.tsx`

- **Pending tour bookings**: Make cards clickable → open `EditTourModal` with `sourceTable='tour_bookings'`
- **Today's tour bookings**: Same clickable edit
- **Guest requests**: Make cards clickable → open `EditRequestModal`
- Add pencil icon to all editable cards

#### 4. Fix `EditTourModal` query invalidation

Currently only invalidates `['guest-tours', unitName, bookingId]`. Add invalidation for all experiences/reception query keys so changes reflect immediately everywhere.

### Files

| File | Change |
|------|--------|
| `src/components/rooms/EditTourModal.tsx` | Add `sourceTable` prop, save to correct table, invalidate all relevant query keys |
| `src/components/rooms/EditRequestModal.tsx` | New modal for editing guest requests (transport, rentals) |
| `src/pages/ExperiencesPage.tsx` | Wire tour bookings + requests to open edit modals on click, add pencil icons |

