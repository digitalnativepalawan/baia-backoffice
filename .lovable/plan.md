
## Current State

The guest management lives in `src/components/admin/RoomsDashboard.tsx` (1187 lines) with tabs: Guest Info, Orders, Docs, Notes, Tours, Vibe, Billing. It's used in both the Admin page and Reception page.

**Already working:**
- Check-in / Check-out flow
- Notes (basic: text + 4 categories + delete)
- Docs (upload file, camera, URL link — 4 doc types)
- Tours (add, delete, status change — no edit)
- Billing via `RoomBillingTab` (payments, adjustments, checkout)
- Vibe records

**Missing / to build:**
- ❌ Editable guest info (read-only card today)
- ❌ Guest type field (Hotel Guest / Walk-In / Friends & Family)
- ❌ Guest status labels (VIP, Long Stay, F&F, Problem Guest)
- ❌ Quick action bar
- ❌ Tours not editable (delete + re-add only)
- ❌ No activity timeline tab
- ❌ Notes have no image/URL attachment
- ❌ Doc types limited (missing driver license, waiver, contract, ID)
- ❌ No image compression before upload
- ❌ No manual charge entry from billing tab (only payments and adjustments)
- ❌ Platform field only has OTA options — no Hotel Guest / Walk-In / F&F

---

## Plan

### New files to create (4)

**1. `src/lib/imageCompress.ts`**
Client-side canvas-based image compression. Targets ≤800KB. Applied before any image upload throughout the system.

```ts
export async function compressImage(file: File, maxKb = 800): Promise<File>
```

**2. `src/components/rooms/EditGuestModal.tsx`**
Quick-edit dialog for guest + booking info. Fields:
- Guest name, phone, email
- Adults, children
- Check-in, check-out dates
- Guest Type (replaces "Platform" for internal use) — 3 pill options: **Hotel Guest | Walk-In Guest | Friends & Family**
- Room rate
- Special requests / notes

On save: updates `resort_ops_guests` (name, phone, email) + `resort_ops_bookings` (dates, adults, children, platform, room_rate, notes, special_requests). Invalidates `rooms-bookings`.

**3. `src/components/rooms/EditTourModal.tsx`**
Dialog that pre-populates all tour fields (tour_name, tour_date, pickup_time, pax, price, provider, notes). On save: `supabase.from('guest_tours').update().eq('id', tour.id)`.

**4. `src/components/rooms/GuestActivityTimeline.tsx`**
Composite timeline. Pulls from 4 sources scoped to the booking:
- `resort_ops_bookings.created_at` → "Check-In" event
- `guest_notes` → note additions (booking_id match)
- `guest_tours` → tour bookings (booking_id match)
- `room_transactions` → billing events (unit_id + booking_id match)
- `orders` → room orders (location_detail = unit.name, date range)

All merged into a single chronological array, rendered as a vertical timeline with icons per type.

---

### Modified files (2)

**5. `src/components/admin/RoomsDashboard.tsx`** — The main integration point

Changes:
- Add `timeline` tab (Clock icon) to the tab list
- **PART 1**: Guest Info tab — add Edit button (pencil icon) opening `EditGuestModal`. Show guest type as a colored badge next to name.
- **PART 5**: Notes — expand categories to `general | guest_preference | complaint | maintenance | staff_note`. Add image upload button below textarea (compress → upload to `guest-documents` bucket → prefix URL in content as `[IMAGE]:url`). Notes renderer detects `[IMAGE]:` prefix and renders `<img>`. Also add URL attachment option. Show `created_by` + timestamp (already present, just make more visible).
- **PART 4**: Tours tab — add pencil icon per tour row → `EditTourModal`.
- **PART 6**: Docs tab — expand doc type list to: passport, driver_license, waiver, government_id, id_card, contract, booking_confirmation, other.
- **PART 2**: Apply `compressImage()` in `uploadDocument()` and note image uploads before storage upload.
- **PART 3**: Add `timeline` tab content that renders `<GuestActivityTimeline>`.
- **PART 8**: Quick action bar — shown above tabs when a booking is active and `!readOnly`. Scrollable horizontal pill row:
  - **Check In** → same as existing button (shows check-in form)
  - **Extend Stay** → small dialog to change check_out date only
  - **Change Room** → select dropdown to pick another ready unit, updates booking's unit_id
  - **Add Tour** → switches to tours tab
  - **Add Note** → switches to notes tab + focuses textarea
- **PART 9**: Status labels as badges next to guest name:
  - **Checked In** → always when occupied
  - **Friends & Family** → `booking.platform === 'Friends & Family'`
  - **Long Stay** → check_out - check_in >= 7 nights
  - **VIP** → booking.notes contains `[VIP]` tag (set via edit modal checkbox)
  - **Problem Guest** → vibe record with High risk level (already tracked in existing `review_risk_level`)

**6. `src/components/rooms/AdjustmentModal.tsx`** — Billing quick edits (PART 7)
- Add a "Quick Charge" section at the top with preset charge type buttons: Room Charge, Experience, Bar Tab, Transport, Laundry
- When selected, pre-populates the `notes` field with the category name
- Also add the option to add a note to any existing transaction (via a small edit icon per charge row in `RoomBillingTab`)

---

## File-by-file summary

```
NEW:  src/lib/imageCompress.ts
NEW:  src/components/rooms/EditGuestModal.tsx
NEW:  src/components/rooms/EditTourModal.tsx
NEW:  src/components/rooms/GuestActivityTimeline.tsx
EDIT: src/components/admin/RoomsDashboard.tsx
EDIT: src/components/rooms/AdjustmentModal.tsx
```

No database migrations required. All features map to existing columns:
- Guest type → stored in `resort_ops_bookings.platform` (new values: "Hotel Guest", "Walk-In Guest", "Friends & Family")
- VIP status → stored as `[VIP]` tag in `resort_ops_bookings.notes` field
- Note images → stored in `guest_notes.content` as `[IMAGE]:https://...` prefix
- Timeline → composite read query from 5 existing tables
