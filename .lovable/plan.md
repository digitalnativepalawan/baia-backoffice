

## Sync Shift Payments and Fix Labor Cost Flow to Resort Ops

### Problem
When staff clock in/out and shifts are marked as paid, those costs don't appear in Resort Ops expenses. Only manual payments from the HR Payments form currently sync.

### Solution
Add auto-sync to Resort Ops expenses whenever shifts are **marked as paid** (individually or bulk "Mark All Paid"). This covers both paths:
- **Shift-based pay** (clock in/out -> mark paid) -- NEW
- **Manual payments** (HR Payments form) -- already working

### Changes to PayrollDashboard.tsx

#### 1. Sync on "Mark Paid" (single shift)
When `markPaid(shiftId)` is called, also insert a `resort_ops_expenses` record:
- **category**: "Labor/Staff"
- **name**: "Shift Pay - [Employee Name]"
- **amount**: The shift's `total_pay`
- **expense_date**: Today
- **vat_status**: "Non-VAT"
- **is_paid**: true
- **notes**: `[shift:shiftId]` (for linking)
- **description**: Date + hours worked

#### 2. Sync on "Mark All Paid" (bulk)
When `markAllPaid(employeeId)` runs, insert one expense per shift being marked, using the same format and `[shift:shiftId]` linking.

#### 3. Unsync on "Mark Unpaid"
When `markUnpaid(shiftId)` is called, delete the linked expense using `notes = [shift:shiftId]`.

#### 4. Unsync on shift delete
When `deleteShift(shiftId)` is called, also delete any linked expense with `[shift:shiftId]`.

### Result
- Clock in/out -> mark paid -> automatically appears as "Labor/Staff" expense in Resort Ops
- Undo (mark unpaid / delete shift) -> removes the expense
- Manual payments from HR Payments form also sync (already working)
- Net profit in Resort Ops naturally includes all labor costs
- Category filter in expenses will show "Labor/Staff" entries

### Files to Update
1. `src/components/admin/PayrollDashboard.tsx` -- update `markPaid`, `markUnpaid`, `markAllPaid`, and `deleteShift` functions

