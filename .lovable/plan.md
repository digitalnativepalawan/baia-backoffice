

## Plan: Broadcast Housekeeping Assignments to All On-Duty Staff

### Current State
- Reception directly assigns a specific housekeeper via one-tap buttons or picker modal
- The `housekeeping_orders` table already has `accepted_by`, `accepted_by_name`, `accepted_at`, `assigned_to` columns
- HousekeeperPage already has realtime subscription (INSERT + UPDATE) with chime sound and a "New Assignments" section showing unaccepted orders
- The accept-with-PIN flow already exists

### What Changes

**The core shift**: Instead of reception picking a specific person, checkout/clean creates an **unassigned** housekeeping order. ALL housekeepers on duty hear the ping. First to accept with PIN gets it. Reception can still force-assign as a fallback.

### Files to Edit

#### 1. `src/pages/ReceptionPage.tsx` — Change assignment flow
- **Checkout flow** (`handleCheckOut`): Stop setting `accepted_by`/`accepted_by_name`/`accepted_at` when creating the housekeeping order. Only set `status: 'pending_inspection'`. Remove the housekeeper picker from checkout modal.
- **Send to Clean** (`handleSendToClean`): Same — create order as unassigned by default. Remove the one-tap housekeeper name buttons from occupied room cards.
- Keep the "Assign" button in the Needs Cleaning section as a **manual override** fallback (already exists).
- **Needs Cleaning section**: Enhance to show "⏳ Waiting for acceptance" when unassigned, with time-since-created. Show "Force Assign" button after ~15 min unassigned.
- Remove `hkEmployeesForCheckout` inline buttons from occupied room cards. Replace with a single "🧹 Clean" button that broadcasts to all.
- Remove housekeeper picker from checkout dialog.

#### 2. `src/pages/HousekeeperPage.tsx` — Already mostly correct
- The "New Assignments" section already shows `pendingOrders` (orders where `!accepted_by`).
- The accept-with-PIN flow already works.
- **Add race condition guard**: After PIN entry, before updating, re-check that `accepted_by` is still null. If someone else accepted first, show "Already assigned to [Name]" toast.
- The realtime subscription already plays chime on INSERT and UPDATE — this will naturally ping all housekeeper devices.

#### 3. `src/components/housekeeping/PasswordConfirmModal.tsx` — No changes needed (already works)

#### 4. `src/components/rooms/HousekeeperPickerModal.tsx` — Keep for manual override only (no changes)

### Detailed Changes

**ReceptionPage.tsx — Checkout dialog:**
- Remove the housekeeper dropdown/selector from checkout UI
- `handleCheckOut`: Create housekeeping order with `assigned_to: null, accepted_by: null` (broadcast mode)
- Remove WhatsApp notification on checkout (housekeepers get the ping instead)

**ReceptionPage.tsx — Occupied room cards:**
- Replace per-housekeeper name buttons with single "🧹 Clean" button
- `handleSendToClean(unit)` — no housekeeper param, creates unassigned order

**ReceptionPage.tsx — Needs Cleaning section (already exists):**
- Unassigned orders show "⏳ Waiting for acceptance" with elapsed time
- "Assign" button remains for manual override (already there)
- When accepted, shows "👤 [Name]" (already there)

**HousekeeperPage.tsx — Accept handler:**
- Add optimistic lock: re-fetch the order's `accepted_by` before writing. If non-null, toast error "Already assigned to [Name]" and refresh list.

### No Database Changes
The `housekeeping_orders` table already has all needed columns (`accepted_by`, `accepted_by_name`, `accepted_at`, `assigned_to`, `status`). Realtime is already enabled on this table.

### No New Tables
The user's suggestion of a `housekeeping_notifications` table is unnecessary — the existing Supabase Realtime postgres_changes subscription on `housekeeping_orders` already broadcasts to all connected housekeeper devices. The chime already plays on INSERT/UPDATE.

### Summary
- 2 files edited: `ReceptionPage.tsx` (simplify to broadcast), `HousekeeperPage.tsx` (add race guard)
- Reception creates unassigned orders → all housekeepers get pinged → first to accept wins
- Manual override remains available in the "Needs Cleaning" section

