
## Auto-Sync Staff Payments to Resort Ops Expenses

### Approach
When a staff payment is recorded in the HR section, automatically create a corresponding expense entry in the `resort_ops_expenses` table under the **"Labor/Staff"** category. This way all payroll costs flow into the Resort Ops financial summary (net profit, margin, etc.) without manual double-entry.

### Changes

#### 1. Update `recordPayment` in PayrollDashboard.tsx
After inserting into `payroll_payments`, also insert a matching record into `resort_ops_expenses` with:
- **category**: "Labor/Staff"
- **name**: Employee name (e.g., "Payroll - Susan")
- **amount**: The payment amount
- **expense_date**: Today's date
- **vat_status**: "Non-VAT" (staff payments are not VAT-applicable)
- **is_paid**: true
- **payment_method**: "Bank Transfer" (default)
- **description**: Payment type + period + any notes
- **All VAT fields**: Set to 0

#### 2. Handle payment edits and deletes
- When a payment is **edited**, update the corresponding expense amount
- When a payment is **deleted**, also delete the linked expense
- Link them via a reference field: store the `payroll_payment_id` in the expense's `notes` or add a linking convention (e.g., description prefix)

#### 3. Linking strategy
Since we can't add columns to `resort_ops_expenses` without a migration, we'll use the `notes` field to store a reference like `[payroll:payment_id]` so we can find and update/delete the linked expense when the payment changes.

### Result
- Every staff payment automatically appears in Resort Ops expenses under "Labor/Staff"
- Net profit calculation (`totalRevenue - foodCost - totalExpenses`) will naturally include payroll costs
- No manual data entry needed -- pay someone in HR, it shows in Resort Ops immediately
- Editing or deleting a payment keeps both tables in sync

### Files to Update
1. `src/components/admin/PayrollDashboard.tsx` -- modify `recordPayment`, `updatePayment`, and `deletePayment` to sync with `resort_ops_expenses`
