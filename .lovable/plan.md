

## Plan: Multi-Select Staff Assignment + Bulk Messaging for Tasks

### Current State
The `EmployeeTaskList.tsx` component uses a single `<select>` dropdown (`assignee` state as a single string) to assign tasks to one employee. The `addTask` function creates one task for one employee and optionally sends via WhatsApp/Messenger to that single person.

### Changes

**File: `src/components/employee/EmployeeTaskList.tsx`**

1. **Replace single-select with multi-select + "All" option**
   - Change `assignee` state from `string` to `string[]`
   - Replace the `<select>` dropdown with a checkbox-based picker: an "All Staff" checkbox at top, then individual employee checkboxes
   - Selected names shown as badges above the list

2. **Bulk task creation**
   - `addTask` loops over selected employee IDs (or all active employees if "All" is selected) and inserts one `employee_tasks` row per employee
   - Shows toast: "Task sent to X staff members"

3. **Bulk messaging after save**
   - After inserting all tasks, loop through each assigned employee and auto-send via the selected method (WhatsApp or Messenger)
   - For WhatsApp: opens each employee's WhatsApp link sequentially (with small delay so browser doesn't block popups — open first immediately, queue rest)
   - For Messenger: same sequential open pattern
   - Toast indicates how many messages were sent vs skipped (no number configured)

4. **"Send via" always visible and hardwired**
   - Keep the 3-button toggle (WhatsApp / Messenger / Don't Send) as-is
   - Default remains WhatsApp
   - This applies to bulk sends too — one method for all recipients

### Files to Edit
- `src/components/employee/EmployeeTaskList.tsx` — multi-select assignee, bulk insert, bulk message send

