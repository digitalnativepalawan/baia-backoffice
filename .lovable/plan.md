

## Plan: Three UI Shells — Guest, Staff, Admin

### Architecture Overview

Restructure the app into 3 distinct interface shells that share the same backend. Each shell has its own layout, home screen, and visual language. No database changes. No functionality removed.

```text
/guest-portal     → Guest Shell (concierge)
/                 → Landing (logo + 3 entry points)
/staff            → Staff Shell (action console) ← NEW
/admin            → Admin Shell (control tower) — existing, restructured
```

### Landing Page (`/` — Index.tsx)

Simplify to 3 large tiles only:
- **I'm a Guest** → `/guest-portal`
- **Staff Login** → PIN login → redirect to `/staff`
- **Admin** → PIN login → redirect to `/admin`

Remove all the current permission-gated navigation buttons. After login, staff and admin go directly to their shell.

---

### Shell 1: Guest Shell (`/guest-portal` — GuestPortal.tsx)

**Refactor the existing page.** Keep all current functionality but:

- Reduce dashboard tiles from 9 to 5 as specified:
  - Order Food, Order Drinks (split current "Order Food" by department), Book Experiences (merge Tour + Transport + Rental into one tile), Request Service (merge Leave Note + general requests), Message Reception (new simple text-to-reception flow)
- Remove "My Orders", "My Requests", "My Bill" from main grid — move to a small "My Activity" link below tiles
- Make tiles much larger (full-width stacked on mobile)
- Add clear success confirmation screens after every action (toast → full-screen green checkmark with "Done" button)
- Use warm hospitality language: "What can we help with?" not "Dashboard"

**Files**: `src/pages/GuestPortal.tsx`

---

### Shell 2: Staff Shell — NEW (`/staff` — StaffShell.tsx)

**New page** that acts as a role-aware action console. After PIN login, detect primary role from permissions and show the appropriate home screen.

**Role detection logic**:
```text
permissions include 'reception'    → Reception Home
permissions include 'housekeeping' → Housekeeping Home
permissions include 'kitchen'      → Kitchen Home
permissions include 'bar'          → Bar Home
permissions include 'experiences'  → Experiences Home
fallback                           → generic staff home with permitted tiles
```

**Reception Home** — card-based layout:
- Today Timeline (arrivals + departures chronologically)
- Arrivals section (units with check-in today)
- Checkouts section (units with checkout today)
- Current Guests (occupied rooms)
- Open Tabs
- Guest Requests / Tours

Each card: room name + status + **one primary action button** (Check In, Check Out, View, etc.)

Reuses existing `ReceptionPage.tsx` logic but restructured into a cleaner card layout.

**Housekeeping Home** — reuses existing `HousekeeperPage.tsx` logic, already well-structured with:
- Needs Cleaning (pending assignments)
- Cleaning In Progress
- Ready Rooms (completed today)

**Kitchen Home** — reuses `DepartmentOrdersView` with `department="kitchen"`:
- New Food Orders (pending tab)
- Preparing Food Orders (preparing tab)

**Bar Home** — reuses `DepartmentOrdersView` with `department="bar"`:
- New Drink Orders
- Preparing Drink Orders

**Staff card rule**: Every operational card shows item name, current state badge, and one primary action button only.

**Role switcher**: If a staff member has multiple roles, show a small tab bar at top to switch between their permitted home screens.

**Files**:
- `src/pages/StaffShell.tsx` (new — layout shell with role detection)
- `src/components/staff/ReceptionHome.tsx` (new — extracts from ReceptionPage)
- `src/components/staff/HousekeepingHome.tsx` (new — wraps HousekeeperPage logic)
- `src/components/staff/KitchenHome.tsx` (new — wraps DepartmentOrdersView)
- `src/components/staff/BarHome.tsx` (new — wraps DepartmentOrdersView)
- `src/components/staff/ExperiencesHome.tsx` (new — wraps ExperiencesPage logic)

---

### Shell 3: Admin Shell (`/admin` — AdminPage.tsx)

**Restructure existing AdminPage** into a control tower layout:

- **Attention Strip** at top: count badges for pending orders, rooms needing cleaning, unconfirmed requests, low stock items
- **Daily Summary** card: occupancy %, revenue today, arrivals/departures count
- **Resort Control Board**: the existing tab system (Operations, People, Config) but renamed:
  - Setup, Reports, Logs, Resort Ops remain
  - Orders/Kitchen/Bar/Rooms/Housekeeping move out of admin (they live in Staff Shell now) — admin keeps read-only overview versions
- Admin-only features: Audit Log, Archive, Staff Access, Devices, Billing Config, Guest Portal Config

**Files**: `src/pages/AdminPage.tsx` (restructure existing)

---

### Routing Changes (`App.tsx`)

```text
/                    → Landing (3 tiles)
/guest-portal        → Guest Shell
/staff               → Staff Shell (NEW, RequireAuth)
/admin               → Admin Shell (RequireAuth, admin-only)
/menu                → Menu (shared, accessed from guest or staff)
/order-type          → Order flow (accessed from staff shell)
/employee            → Employee Portal (clock in/out, pay, schedule)
```

Remove standalone routes: `/kitchen`, `/bar`, `/housekeeper`, `/reception`, `/experiences` — these are now sub-views inside `/staff`.

---

### UX Rules Enforcement

1. **Guest never sees** staff/admin navigation, operational terminology, or status codes
2. **Staff never sees** guest marketing tiles or admin config options
3. **Every card answers**: "What do I do next?" with one clear action button
4. **Irrelevant modules hidden** — permission system already supports this, just needs cleaner gating at shell level
5. **Success confirmations** — guest actions get full-screen confirmations; staff actions get toast + auto-advance

---

### Summary of File Changes

| Action | File |
|--------|------|
| Rewrite | `src/pages/Index.tsx` — 3-tile landing |
| Refactor | `src/pages/GuestPortal.tsx` — 5 tiles, warm language, success screens |
| Create | `src/pages/StaffShell.tsx` — role-aware staff console |
| Create | `src/components/staff/ReceptionHome.tsx` |
| Create | `src/components/staff/HousekeepingHome.tsx` |
| Create | `src/components/staff/KitchenHome.tsx` |
| Create | `src/components/staff/BarHome.tsx` |
| Create | `src/components/staff/ExperiencesHome.tsx` |
| Restructure | `src/pages/AdminPage.tsx` — attention strip + daily summary + control board |
| Update | `src/App.tsx` — new `/staff` route, remove standalone department routes |
| Keep | All existing components, hooks, libs — reused inside new shells |

No database changes. No functionality removed. Existing pages become composable pieces inside the new shells.

