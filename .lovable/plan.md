

## Prevent Double Bookings: Real-Time Availability in Reservation Form

### Problem
The conflict check only fires when the receptionist clicks "Create" — by then they've already filled the whole form. There's no visual feedback while selecting a room or dates, making it easy to miss conflicts.

### Fix: Three layers of protection

**1. Room dropdown shows availability badges (primary fix)**
When both check-in and check-out dates are filled, each room in the dropdown shows a colored indicator:
- Green dot + "Available" for open rooms
- Red dot + "Booked: [Guest Name] Mar 10-13" for conflicting rooms
- Conflicting rooms are pushed to the bottom of the list and visually dimmed

**2. Inline conflict warning banner**
When the user selects a room that has conflicts for the chosen dates, show a persistent red warning banner below the room selector (before they even try to save): "⚠ Double Room #2 is booked by John Turner Mar 11-13. Pick another room or change dates."

**3. Block save for non-managers (tighten override)**
Currently any user who triggers the conflict modal can still see the override button if `canManage` is true. Keep that, but for non-managers, completely block the save — no override option, must pick an alternative room.

### File to Edit
1. `src/components/reception/AddReservationModal.tsx`
   - Add a `useMemo` that runs `findConflicts` whenever `form.unitId`, `form.checkIn`, or `form.checkOut` change → produces `liveConflicts` array
   - Render inline warning banner when `liveConflicts.length > 0`
   - Enhance room `<SelectItem>` to show availability status per room using `findConflicts` for each room against the selected dates
   - Sort rooms: available first, conflicting last (dimmed)

