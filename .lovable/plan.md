

## Fix: Auto-Reset Order Destination After Sending

### The Problem
When staff clicks "Place Another Order" after sending an order, the destination (e.g. Walk-In / Table 1) stays locked in. The staff has to manually leave the menu section and come back to pick a new customer.

### The Fix
One small change in `CartDrawer.tsx`: when "Place Another Order" is clicked, reset the order type and location fields so the staff is prompted to choose a new destination.

### Technical Details

**File: `src/components/CartDrawer.tsx`** (line 291)

Change the "Place Another Order" button handler from:
```js
onClick={() => { setSubmitted(false); }}
```
to:
```js
onClick={() => {
  setSubmitted(false);
  setSelectedOrderType('');
  setSelectedLocation('');
  setPaymentType('');
  setGuestName('');
  setScheduleMode('asap');
}}
```

This resets all order-specific fields so the staff sees the "Where's your order?" selection again, exactly as if they opened a fresh order. No other files need changes.

