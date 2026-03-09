

## Fix Service Board Actions + Add Invoice to Service Mode

### Problems

1. **Kitchen/Bar can't push orders forward**: When kitchen marks food "Ready" and there are no bar items, the order auto-sets to `Served` status. But the order then sits in the "Ready" column on the kitchen board with no action button — because "Mark Served" requires `reception` permission. The same issue applies to bar.

2. **No invoice on service boards**: Walk-in, family & friends orders have no way to generate an invoice from the service screens. Invoice PDF/WhatsApp is only available in the Admin OrderCard. Kitchen/bar/reception staff need this too.

3. **Guest portal orders already work**: The `OrdersView` in `GuestPortal.tsx` already queries all orders by `room_id` with realtime subscriptions. Room charges already flow to `room_transactions` for the bill view. This part is working correctly.

---

### Changes

**1. `ServiceOrderCard.tsx` — Allow all departments to serve/pay orders**

The core bug: `mark-served` and `mark-paid` are gated behind `canEdit(permissions, 'reception')`. But a kitchen-only chef should be able to mark an order as served when all items are ready — especially in a small resort where one person handles everything.

Fix: Allow `mark-served` when the user has edit permission for **any** of `kitchen`, `bar`, or `reception` (not just reception). Similarly for `mark-paid`. The logic becomes:
- `canServe = canEdit(perms, 'reception') || canEdit(perms, 'kitchen') || canEdit(perms, 'bar')`
- Use `canServe` instead of `canEdit(perms, 'reception')` for serve/pay actions

This applies to both primary actions and secondary actions, and in `ServiceOrderDetail.tsx` as well.

**2. `ServiceOrderCard.tsx` + `ServiceOrderDetail.tsx` — Add invoice buttons**

For orders with status `Served` or `Paid` that are **not** Room/Tab (i.e., Walk-In, DineIn, Beach):
- Show a small invoice icon button on the card
- Show "Download Invoice" and "Send WhatsApp" buttons in the detail drawer
- Import `generateInvoicePdf` and `buildInvoiceWhatsAppText` from `@/lib/generateInvoicePdf`
- Need resort profile: add `useResortProfile` hook to `ServiceBoard.tsx` and pass it down

**3. `ServiceBoard.tsx` — Pass resort profile**

- Import `useResortProfile` hook
- Pass `resortProfile` to `ServiceOrderCard` and `ServiceOrderDetail`

---

### File Summary

```
EDIT: src/components/service/ServiceOrderCard.tsx  — broaden serve/pay perms, add invoice button
EDIT: src/components/service/ServiceOrderDetail.tsx — broaden serve/pay perms, add invoice/WhatsApp buttons  
EDIT: src/components/service/ServiceBoard.tsx       — pass resortProfile down
```

No database changes. No new files.

