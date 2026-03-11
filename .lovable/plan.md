

## Embed Full Reception Dashboard Below Service Reception Orders

### What the user wants
The `/service/reception` page currently only shows the ServiceBoard (order Kanban). The user wants the full Reception operational dashboard (room status metrics, current guests, walk-in/sell room, recent room orders, booking calendar — everything visible in the screenshot) displayed below the orders, fully functional.

### Approach
The `ReceptionPage` component already accepts an `embedded` prop and contains all the reception functionality. The simplest approach is to embed it directly into `ServiceReceptionPage` below the `ServiceBoard`.

### Changes

**File: `src/pages/ServiceReceptionPage.tsx`**
- Import `ReceptionPage`
- Change the layout from `overflow-hidden` to `overflow-y-auto` so the full page scrolls
- Keep `ServiceHeader` and `ServiceBoard` at the top
- Add a `<Separator>` then render `<ReceptionPage embedded />` below the service board
- The ServiceBoard currently uses `flex-1 overflow-y-auto` internally, so we need to remove the `h-screen` constraint and let both sections stack vertically in a scrollable container

This gives the cashier/reception staff a single scrollable page: orders at top, full reception operations below — no functionality gaps.

