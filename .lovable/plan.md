

## Service Mode UI Refresh and Transparent Billing

### Problems Identified

1. **Service Mode selector page** looks basic — large blocky cards with dated icons
2. **Service board cards** are functional but visually flat — need better hierarchy, color coding, and polish
3. **Critical billing bug**: Kitchen/Bar boards show "Mark Paid" for Room and Tab orders. Room orders are already charged to the room bill via `room_transactions`. Tab orders collect payment at tab close. These should auto-complete to "Paid" when served, not require a manual "Mark Paid" click.

### Changes

**1. `src/pages/ServiceModePage.tsx` — Modern selector UI**
- Replace blocky card buttons with a glassmorphism card grid (2-col on tablet, 1-col on phone)
- Use modern Lucide icons: `Flame` (kitchen), `GlassWater` (bar), `BellRing` (reception)
- Add subtle gradient backgrounds per department, animated hover/tap states
- Show live order count per department (query from orders table)
- Add current staff name from session at top

**2. `src/components/service/ServiceHeader.tsx` — Cleaner header**
- Use the updated icons (`Flame`, `GlassWater`, `BellRing`)
- Add a subtle gradient accent line under the header matching dept color
- Show staff name from session

**3. `src/components/service/ServiceOrderCard.tsx` — Modern card redesign**
- Add a colored left border strip per order status (gold=new, orange=preparing, green=ready, blue=served)
- Better typography hierarchy: location bold, guest name subtle, items in a clean list
- Payment type badge: show `🏠 Room Charge` or `📋 Tab` or `💳 Cash` so staff knows at a glance
- Replace emoji dept indicators with small colored dot + icon pairs
- Remove "Mark Paid" button for Room and Tab orders (handled automatically)
- For Room/Tab orders when status is "Served", show a muted "Charged to Room" or "On Tab" indicator instead of an action button

**4. `src/components/service/ServiceBoard.tsx` — Smart auto-complete for Room/Tab orders**
- In `handleAction` for `mark-served`: If the order has `payment_type === 'Charge to Room'` or `tab_id` is set, automatically set status to `Paid` and `closed_at` in the same update (since no separate payment collection is needed)
- This means Room/Tab orders flow: New → Preparing → Ready → Served → auto-Paid (disappears from board)
- Walk-in/Dine-in orders still require manual "Mark Paid" at reception

**5. `src/components/service/ServiceOrderDetail.tsx` — Updated detail drawer**
- Match the updated icon set
- Show payment type prominently (Room Charge / Tab / Direct Payment)
- Hide "Mark Paid" action for Room/Tab orders
- Show "This order is charged to [Room Name]" or "This order is on [Tab Name]" as an info banner
- Use the updated status colors

**6. `src/index.css` — Add subtle gradient utilities**
- Add dept-specific gradient classes for card accents

### File Summary

```
EDIT: src/pages/ServiceModePage.tsx          — modern selector with live counts
EDIT: src/components/service/ServiceHeader.tsx — updated icons, staff name
EDIT: src/components/service/ServiceOrderCard.tsx — modern card design, smart billing display
EDIT: src/components/service/ServiceBoard.tsx — auto-Paid for Room/Tab on serve
EDIT: src/components/service/ServiceOrderDetail.tsx — billing transparency, updated UI
EDIT: src/index.css — gradient utilities
```

No database changes. No new files. All existing functionality preserved — only visual improvements and smart billing logic added.

