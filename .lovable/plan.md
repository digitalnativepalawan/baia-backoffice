

## Plan: Add Scheduled Orders View with Time Display

### What Changes

Modify `DepartmentOrdersView.tsx` to split orders in the "New" (pending) tab into two sections: **"Due Now"** and **"Scheduled for Later"**. Scheduled orders show their serve time, prep time (30 min before), and countdown. The "Start Preparing" button is disabled until within the prep window.

### File: `src/components/DepartmentOrdersView.tsx`

**1. Add helper functions:**
- `isScheduledFuture(order)` — returns true if `scheduled_for` exists and is more than 30 minutes from now
- `getPrepTime(scheduledFor)` — returns a Date 30 minutes before `scheduled_for`
- `formatScheduledTime(date)` — formats as "7:00 AM" etc.

**2. Split filtered orders in the pending tab:**
```typescript
const nowOrders = filtered.filter(o => !isScheduledFuture(o));
const scheduledOrders = filtered.filter(o => isScheduledFuture(o));
```

Only applies to the `pending` tab. `preparing` and `ready` tabs show all orders normally.

**3. Render two sections in the pending tab:**
- "Due Now / ASAP" section header with lightning bolt icon, showing `nowOrders`
- "Scheduled for Later" section header with clock icon, showing `scheduledOrders` sorted by `scheduled_for` ascending

**4. Enhanced scheduled order card:**
- Replace the current generic "Scheduled" badge with a detailed one showing:
  - Serve time: "🕒 7:00 PM"
  - Prep time: "⏰ Prepare at 6:30 PM"  
  - Countdown: "8 hours from now"
- Disable "Start Preparing" button for scheduled orders not yet in prep window (>30 min before serve time), show "Not yet — prep at 6:30 PM" as disabled text instead

**5. Add a 1-minute interval** to re-evaluate `isScheduledFuture` so orders automatically move from "Scheduled" to "Due Now" when the prep window arrives (using existing `intervalRef`).

**6. Update status counts** to show scheduled count separately in the pending tab badge (e.g., "3 + 2 scheduled").

### No database changes needed
The `scheduled_for` column already exists on the `orders` table.

### Files to edit

| File | Change |
|------|--------|
| `src/components/DepartmentOrdersView.tsx` | Split pending orders into now/scheduled sections, add time display, disable premature prep |

