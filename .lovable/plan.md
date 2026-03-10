

## Add "Currently Occupied" Quick-Select to Order Type Page

### Problem
Staff must manually select order types and pick rooms from dropdowns, even though the system already knows which rooms are occupied and by whom. There's no quick way to say "this order is for David Le in Double Room #1" — the occupied guest data exists in the database but isn't surfaced on the ordering screen.

### Solution
Add a **"Current Guests"** section at the top of the Order Type page (staff mode only) showing real-time occupied rooms with guest names. One tap selects the guest and auto-fills everything — room, guest name, order type — then navigates straight to the menu. The existing `roomName` param ensures billing flows through to the guest portal.

### Changes

**1. `src/pages/OrderType.tsx`** — Add occupied guests section
- Query `units` where `status = 'occupied'`, join with `resort_ops_bookings` + `resort_ops_guests` to get guest names
- Cross-reference via `resort_ops_units` (name-based matching as per existing pattern)
- Render a "Current Guests" card grid above the order type buttons (staff mode only)
- Each card shows: room name, guest name, a blue "occupied" dot
- Tapping a guest card sets `orderType=Room`, `location=<unit_name>`, `roomName=<unit_name>`, `guestName=<guest_name>` and navigates directly to `/menu`
- Cards use the same dark card style as the rest of the UI with blue accent for occupied status

**2. No database changes needed** — all data already exists in `units.status`, `resort_ops_bookings`, and `resort_ops_guests`

### Flow
```text
Staff opens Order Type page
  → Sees "Current Guests" section at top:
     [🔵 Double Room #1 — David Le]  [🔵 Suite #2 — Jane Smith]
  → Taps "David Le" card
  → Navigates to /menu?mode=staff&orderType=Room&location=Double Room #1&roomName=Double Room #1&guestName=David Le
  → CartDrawer matches room → sets room_id → auto-defaults "Charge to Room"
  → Order submitted → room_transaction created → appears on guest portal bill ✓
```

Staff can still use the traditional order type buttons below for walk-ins, friends & family, etc.

