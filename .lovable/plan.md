

## Plan: Fix Payment Permissions, Room Order Visibility, and Checkout Flow

### Problem
1. **Anyone can mark orders "Paid"** — kitchen/bar staff see "Mark Paid" buttons they shouldn't
2. **Paid orders disappear** from room billing — the query only fetches orders with active statuses (New/Preparing/Ready/Served), so "Paid" orders vanish
3. **No mid-stay vs final checkout distinction** — the checkout modal forces all unpaid orders to be settled individually before checkout instead of one final settlement

### Changes

#### 1. Restrict "Mark Paid" to reception/admin only

**`src/components/service/ServiceOrderDetail.tsx`** — Gate the "Mark Paid" action behind `canEdit(permissions, 'reception')` instead of the broad `canServe` check (which includes kitchen/bar).

**`src/components/service/ServiceOrderCard.tsx`** — Same fix: only show "Mark Paid" primary action when user has `reception:edit` or `orders:manage` or admin permissions. Kitchen/bar staff keep their prep/ready buttons but never see payment buttons.

**`src/components/service/ServiceBoard.tsx`** — Add a permissions prop and pass it down so the board-level action handler can also gate `mark-paid`.

**`src/components/admin/OrderCard.tsx`** — Admin page already has full access, no change needed.

**`src/components/DepartmentOrdersView.tsx`** — Already doesn't have "Mark Paid" buttons (only Start Preparing / Mark Ready). No change needed.

#### 2. Show ALL room orders in billing (paid + unpaid)

**`src/components/rooms/RoomBillingTab.tsx`**:
- Change the unpaid orders query to also fetch orders with status `'Paid'` for this room (add `'Paid'` to the `.in('status', [...])` filter)
- Rename the query/variable from `unpaidOrders` to `roomOrders`
- Split display into two groups: unpaid (active) and paid (history)
- Paid orders show with a green "Paid" badge and are non-actionable
- Balance calculation only counts unpaid orders

#### 3. Rework checkout to do final settlement

**`src/components/rooms/CheckoutModal.tsx`**:
- Remove the per-order "Mark Paid" buttons and the blocker that prevents checkout when unpaid orders exist
- Instead show all unpaid orders as line items in the final bill summary
- Include unpaid F&B total in the balance calculation
- On checkout: mark ALL unpaid room orders as `'Paid'` in one batch update, then proceed with existing checkout logic (room → to_clean, housekeeping assignment, etc.)
- The final payment amount defaults to the total remaining balance (room charges + unpaid F&B - payments already received)

### Files
```
EDIT  src/components/service/ServiceOrderDetail.tsx  — Gate "Mark Paid" behind reception/admin permission
EDIT  src/components/service/ServiceOrderCard.tsx     — Gate "Mark Paid" behind reception/admin permission
EDIT  src/components/rooms/RoomBillingTab.tsx          — Fetch ALL orders (incl. Paid), split display
EDIT  src/components/rooms/CheckoutModal.tsx            — Remove per-order pay blocker, batch-settle on checkout
```

No database migrations needed — the existing `orders.status` field already supports 'Paid' and `room_transactions` already handles payments.

### Technical Detail

**Permission gating** uses existing `canEdit(permissions, 'reception')` or `permissions.includes('admin')` checks. The `canManage(permissions, 'orders')` also grants payment rights (receptionist template already has `orders:manage`). Kitchen (`kitchen:edit`) and bar (`bar:edit`) permissions never include reception/orders:manage, so those staff naturally lose the Mark Paid button.

**Room billing query change**: Currently filters `.in('status', ['New', 'Preparing', 'Ready', 'Served'])`. Will change to `.in('status', ['New', 'Preparing', 'Ready', 'Served', 'Paid'])` and partition results client-side.

**Checkout batch settle**: After recording the final payment transaction, runs `supabase.from('orders').update({ status: 'Paid', closed_at: now }).eq('room_id', unitId).in('status', ['New', 'Preparing', 'Ready', 'Served'])` to close all remaining orders at once.

