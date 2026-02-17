

## Fix Guest Cards to Show Booking Details

### Problem
The Guests section currently only displays each guest's name, email, and phone. It does not show their associated booking information (check-in/out dates, number of guests, booking platform, amount).

### Solution
Redesign the Guests section to join guest data with their bookings, so each guest card shows:
- Guest name
- Check-in and check-out dates
- Number of guests (adults)
- Booking platform
- Amount (room rate / paid amount)

### Technical Changes

**File: `src/components/admin/ResortOpsDashboard.tsx`**

Update the Guests section (lines 288-312) to:

1. For each guest, look up their bookings from the `bookings` array using `guest_id`
2. Display each booking's details inline under the guest name:
   - Check-in / Check-out dates
   - Adults count
   - Platform (e.g., Booking.com, Direct)
   - Room rate and paid amount
3. If a guest has multiple bookings, show each one as a sub-row

The card layout for each guest will look like:

```
Guest Name
  Check-in: Jan 24 -> Check-out: Jan 26 | 4 guests | Booking.com | P19,003
  Check-in: Feb 10 -> Check-out: Feb 12 | 2 guests | Direct | P5,000
```

This keeps the mobile-first stacked card layout and avoids horizontal scrolling.

