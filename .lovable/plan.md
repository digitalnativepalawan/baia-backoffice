

## Plan: Fix Missing Room Charges When Staff Confirms via Reception/Experiences

### Root Cause

There are **two separate confirm flows** for tours and requests, and only one creates `room_transactions`:

| Action | Page | Creates room_transaction? |
|--------|------|--------------------------|
| Confirm tour booking | **GuestPortalConfig** (Admin) | YES |
| Confirm tour booking | **ReceptionPage** | NO |
| Confirm tour booking | **ExperiencesPage** | NO |
| Confirm guest request | **GuestPortalConfig** (Admin) | YES |
| Confirm guest request | **ReceptionPage** | NO |
| Confirm guest request | **ExperiencesPage** | NO |
| Complete tour/request | All pages | NO |

When Reception or Experiences staff confirms a transport or rental, it only updates the status -- it never inserts a `room_transactions` charge. So the guest bill stays empty. The charge logic only exists in `GuestPortalConfig.tsx`.

Additionally, `ExperiencesPage.updateRequestStatus` just does a simple status update with no price parsing or room charge insertion.

### Changes

**1. Fix `ReceptionPage.tsx` — `confirmTourBooking` and `updateRequestStatus`**

- `confirmTourBooking`: After confirming, parse the price from the tour booking and insert a `room_transactions` charge (same pattern as `GuestPortalConfig.confirmTour`)
- `updateRequestStatus` (when status = 'confirmed'): Parse price from `details` string, look up the room info, and insert a `room_transactions` charge (same pattern as `GuestPortalConfig.confirmRequest`)

**2. Fix `ExperiencesPage.tsx` — `confirmTourBooking` and `updateRequestStatus`**

- Same fix: when confirming a tour booking, insert a room charge
- When confirming a guest request, parse price from details and insert a room charge
- Need to add a `parsePriceFromDetails` helper (or extract the one from GuestPortalConfig)

**3. Fix `ExperiencesPage.tsx` — `updateTourStatus` (guest_tours confirm)**

- When confirming admin-created `guest_tours` that have a price and booking_id, also insert a `room_transactions` charge

**4. Guest Bill display fix in `GuestPortal.tsx`**

- The BillView currently filters `transaction_type === 'charge'` for charges -- but some transactions inserted elsewhere may use `total_amount > 0` pattern. Normalize the filter to handle both: charges are `total_amount > 0`, payments are `total_amount < 0` (matching `RoomBillingTab` logic)

### Technical Details

The price parsing helper (already in GuestPortalConfig):
```typescript
const parsePriceFromDetails = (details: string): number => {
  const match = details.match(/₱([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
};
```

Room info lookup pattern (already in GuestPortalConfig):
```typescript
const getRoomInfo = async (roomId: string) => {
  const { data } = await supabase.from('units').select('id, unit_name').eq('id', roomId).single();
  return data;
};
```

Both will be added to ReceptionPage and ExperiencesPage. The insert pattern is identical to what GuestPortalConfig already does successfully.

### Files to Edit
- `src/pages/ReceptionPage.tsx` — add room charge on confirm for tours and requests
- `src/pages/ExperiencesPage.tsx` — add room charge on confirm for tours and requests  
- `src/pages/GuestPortal.tsx` — normalize charge/payment filtering in BillView

