

## Plan: Scope Room Data to Active Booking Only

### Problem
After a guest checks out, documents, notes, tours, orders, and transactions from previous stays still show on the room card. This confuses staff because the room appears to still have guest data even though it's empty. All that historical data should only be accessible via Resort Ops, not cluttering the live room view.

### Root Cause
All room detail queries filter by `unit_name` only — they never filter by the current booking. So every past guest's documents, notes, tours, and transactions accumulate on the room forever.

### Solution
Scope all room detail tab queries to the **active booking** when one exists. When no booking is active (room is `to_clean` or `ready`), show empty state instead of old data.

### Changes

**1. RoomsDashboard — Filter queries by active booking** (`src/components/admin/RoomsDashboard.tsx`)
- **Documents**: Filter `guest_documents` by `guest_id` from current booking (not just `unit_name`). Show empty when no active booking.
- **Notes**: Filter `guest_notes` by `booking_id` from current booking. Show empty when no booking.
- **Tours**: Filter `guest_tours` by `booking_id` from current booking. Show empty when no booking.
- **Orders**: Filter `orders` to only show orders created during the current booking's date range.
- **Vibe records**: Already filtered by `checked_out: false` — keep as-is.
- **Billing tab** (`RoomBillingTab`): Filter `room_transactions` by `booking_id`.

**2. RoomBillingTab — Accept and use booking_id filter** (`src/components/rooms/RoomBillingTab.tsx`)
- Pass `bookingId` prop and filter transactions to only show current booking's transactions.

**3. useRoomTransactions — Add optional booking filter** (`src/hooks/useRoomTransactions.ts`)
- Add optional `bookingId` parameter; when provided, filter transactions by `booking_id` instead of showing all for the unit.

**4. Empty state messaging**
- When a room has no active booking, each tab shows: "No active guest — check in to start" instead of stale data.

### What stays accessible
- All historical data remains in the database untouched
- Resort Ops dashboard continues to show full booking history
- Order Archive shows all past orders
- No data is deleted — it's just filtered from the live room view

### Files to Edit
1. `src/components/admin/RoomsDashboard.tsx` — scope document/note/tour/order queries to active booking
2. `src/components/rooms/RoomBillingTab.tsx` — accept bookingId prop for filtering
3. `src/hooks/useRoomTransactions.ts` — add bookingId filter option

