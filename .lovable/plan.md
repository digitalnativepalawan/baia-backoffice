

## Guest Self-Service Ordering

Enable accommodated guests to place orders directly from their phone, verified by room number and guest name, with all charges automatically added to their room bill.

---

### How It Works

1. On the landing page, a new "Guest Ordering" section appears below "View Menu" and "Staff Login"
2. Guest enters their room number and name
3. System verifies against active bookings (unit status = "occupied", check-in/check-out dates, guest name match)
4. Once verified, guest is sent to the menu in a new "guest-order" mode
5. Guest browses and adds items to cart
6. CartDrawer auto-sets payment to "Charge to Room" with no payment selection needed
7. Order is submitted, routed to Kitchen/Bar, and a room_transaction is created automatically
8. Session stored in sessionStorage, expires after 4 hours

---

### Changes

**1. Landing Page (`src/pages/Index.tsx`)**

Add a "Guest Ordering" section below "View Menu" when no staff session is active:
- Room number dropdown (populated from occupied units)
- Guest name input field
- "Start Ordering" button
- Verification logic: query `units` (status = occupied) joined with `resort_ops_bookings` (today between check_in and check_out) joined with `resort_ops_guests` (full_name fuzzy match)
- On success, store guest session in sessionStorage and navigate to `/menu?mode=guest-order`

**2. Guest Session Hook (`src/hooks/useGuestSession.ts`)** -- NEW

- Reads/writes `guest_session` key in sessionStorage
- Stores: room_id, room_name, guest_name, booking_id, expires (4 hours)
- Auto-clears on expiry
- Provides `clearGuestSession()` for logout

**3. Menu Page (`src/pages/MenuPage.tsx`)**

- Detect `mode=guest-order` from URL params
- Show a banner at top: "Ordering for Room {name} - {guest}" with a "Sign Out" button
- Pass mode through to CartDrawer

**4. Cart Drawer (`src/components/CartDrawer.tsx`)**

- New mode: `guest-order`
- When in guest-order mode:
  - Auto-set `selectedOrderType` to "Room" and `selectedLocation` to guest's room name (from session)
  - Auto-set `guestName` from session
  - Auto-set `paymentType` to "Charge to Room"
  - Hide order type selection, payment type selection, and guest name input (all pre-filled)
  - Show a simple note: "All charges will be added to Room {name}"
  - On submit, create room_transaction automatically (same as current "Charge to Room" logic)
  - Staff name set to "Guest Self-Service"
- After order sent, "Place Another Order" keeps the same room context (unlike staff reset)

**5. Router (`src/App.tsx`)**

- No changes needed -- `/menu` is already public (no RequireAuth wrapper)

---

### Technical Details

**Guest Verification Query:**
```sql
SELECT u.id as unit_id, u.unit_name, g.full_name, b.id as booking_id
FROM units u
JOIN resort_ops_bookings b ON b.unit_id = u.id
JOIN resort_ops_guests g ON g.id = b.guest_id
WHERE u.status = 'occupied'
  AND CURRENT_DATE >= b.check_in
  AND CURRENT_DATE < b.check_out
  AND LOWER(g.full_name) = LOWER(:guestName)
  AND u.unit_name = :roomName
```

**Files to create:**
- `src/hooks/useGuestSession.ts`

**Files to modify:**
- `src/pages/Index.tsx` -- Add guest ordering form
- `src/pages/MenuPage.tsx` -- Add guest-order mode banner
- `src/components/CartDrawer.tsx` -- Add guest-order mode with auto-filled fields

**No database changes needed** -- all required tables and columns already exist.

**Security:**
- Guests can only order for their own verified occupied room
- Session expires after 4 hours
- Payment is always "Charge to Room" (no other options)
- All orders visible in audit log marked as "Guest Self-Service"
- No access to staff features, admin, kitchen, or bar views

