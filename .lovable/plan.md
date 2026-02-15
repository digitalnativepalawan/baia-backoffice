

## Efficient Tab-Based Ordering: Keep All Items on the Original Tab

### Problem
When staff adds items to a served order, the new order is created separately but it already links to the same `tab_id`. However, from the **staff orders view**, there's no easy way to see which tab an order belongs to or to add items directly to a tab's invoice. The admin also needs a way to share consolidated invoices from the staff view.

### Changes

### 1. Staff Orders View - Link "Add Items" to the Tab
**File: `src/components/staff/StaffOrdersView.tsx`**

When the user clicks "Add Items" on a served order that has a `tab_id`, the new order already inherits the `tab_id` (this is working correctly). No change needed here for the insert logic.

### 2. Order Card - Show Tab Link and Add "View Tab Invoice" Button
**File: `src/components/admin/OrderCard.tsx`**

- Show a small "Tab" badge on orders that belong to a tab, so staff can see at a glance that this order is part of a larger tab
- Add a "View Tab/Invoice" button for orders linked to a tab, which opens the TabInvoice view showing the consolidated bill with all orders for that tab
- This lets admin/staff share the full consolidated invoice (PDF or WhatsApp) from the tab view

### 3. Staff Orders View - Add Tab Invoice Dialog
**File: `src/components/staff/StaffOrdersView.tsx`**

- Import the `TabInvoice` component
- Add a dialog/drawer that opens when staff clicks "View Tab/Invoice" on an order card
- This shows the full consolidated tab with all orders, download, and WhatsApp share options
- Pass a new `onViewTab` callback prop to `OrderCard`

### 4. OrderCard Props Update
**File: `src/components/admin/OrderCard.tsx`**

- Add `onViewTab?: (tabId: string) => void` prop
- When order has a `tab_id`, show a "Tab Invoice" button that calls `onViewTab(order.tab_id)`
- The "Add Items" button remains available on served orders with a tab, and any new items added will automatically be linked to the same tab

### Technical Details

```text
Order Card Layout (for orders with a tab):
+------------------------------------------+
| Room - Room 5           [Tab] [Served]   |
| 2 minutes ago                            |
|                                          |
| 1x Mango Shake              P150        |
|                                          |
| P150                                     |
| [Add Items] [Tab Invoice] [PDF] [WA]    |
|                              [Mark Paid] |
+------------------------------------------+
```

- The "Tab Invoice" button opens a dialog with the full `TabInvoice` component showing all orders under that tab
- From there, admin can download the consolidated PDF or share via WhatsApp
- Adding items from either the tab invoice view or the order card "Add Items" button will create a new order linked to the same tab
- No database changes needed -- `tab_id` already exists on orders

