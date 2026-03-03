
# Fix Housekeeping Flow, Schedule Editing, and Shift Type Bug

## Issue 1: Housekeeping Inspection Still Stuck

**Root Cause:** The `completeInspection()` function on line 144 does call `setCurrentStep('cleaning')`, but the `qc.invalidateQueries()` calls on lines 141-142 trigger a parent re-render. In `HousekeeperPage.tsx`, the `activeOrder` is set from `allOrders` query data. When the query refreshes after invalidation, the parent component may cause the `HousekeepingInspection` to re-mount, resetting `currentStep` back to the `derivedStep` (which reads from the now-updated `order.status`).

**Fix in `src/components/admin/HousekeepingInspection.tsx`:**
- Move `setCurrentStep('cleaning')` BEFORE the query invalidations so the UI transitions first
- Add a guard: if `currentStep` is already `'cleaning'`, keep it there even if the derived step would say otherwise (use `useEffect` sync or move invalidation to after state is set)
- Alternatively, invalidate queries after a short delay so React processes the state update first

**Fix in `src/pages/HousekeeperPage.tsx`:**
- When `activeOrder` is set and the `allOrders` query refreshes, update `activeOrder` with the fresh data from the query so the order object stays in sync. This prevents stale props. Add a `useEffect` that syncs `activeOrder` with the latest data from `allOrders`.

## Issue 2: Schedule Shifts - Edit/Delete Visibility

**Current state:** Edit and Delete already exist via:
- Click on a shift block to open Edit modal
- Hover over a shift to see Edit/Delete icons (desktop)
- Long-press on mobile opens a context sheet with Edit/Delete/Duplicate

**The issue:** These actions are not obvious. The hover icons are tiny and hidden until hover. On mobile, long-press is not discoverable.

**Fix in `src/components/admin/WeeklyScheduleManager.tsx`:**
- Make the Edit and Delete icons always visible (not just on hover) by removing the `hidden group-hover/block:flex` class and using `flex` directly
- On the shift block, show the shift type label more prominently so users know they can interact with it
- No functional changes needed -- the edit/delete already works

## Issue 3: Task Colors (Deferred)

The user mentioned task color-coding by category. This requires:
- Adding a `category` column to `employee_tasks` table
- UI for selecting category when creating tasks
- Color mapping in the schedule timeline

This is a feature enhancement, not a bug fix. Will note it but focus on the critical fixes first. Can be implemented in a follow-up.

## Issue 4: Shift Type Preset Resets Custom Time

**Root Cause (line 763):** Clicking any preset button (Morning, Evening, Maintenance) overwrites `time_in` and `time_out`:
```
onClick={() => setShiftForm((f) => ({ ...f, time_in: p.time_in, time_out: p.time_out }))}
```

**Fix in `src/components/admin/WeeklyScheduleManager.tsx`:**
- Add a `shiftType` state to the `ShiftModal` component to track the selected type label independently
- Preset buttons should ONLY set the shift type label, NOT change times, when the user has already manually edited the time fields
- Add a `userEditedTime` flag: when the user changes time_in or time_out manually, set this flag. If the flag is set, preset buttons only change the label. If not set (fresh form), presets still set both label and times for convenience.
- Simpler approach: Split the preset into two behaviors -- on a fresh "Add" form, presets set times. On an "Edit" form or after any manual time change, presets only act as labels.

Actually, simplest correct fix: Add a separate `shiftType` state tracked in the modal. Presets always set times (that's their purpose as quick-fill). The real issue the user describes is specifically about the interaction: they set a custom time, then tap a shift type expecting it to be a label, but it overwrites their time. 

**Solution:** Convert shift type to a separate selector that does NOT change times. Move it above the time fields. If the user wants preset times, they click the preset and THEN can adjust. The type is purely a label.

### Changes to ShiftModal:
- Add `shiftType` local state (inferred from current times on edit, default 'Morning' on add)
- Shift Type buttons set only the `shiftType` label, no longer modify time_in/time_out  
- Add a separate "Use Preset Times" link/button under the type selector for users who want to auto-fill times from the preset

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/HousekeepingInspection.tsx` | Reorder state update before query invalidation; ensure `currentStep` persists through re-renders |
| `src/pages/HousekeeperPage.tsx` | Sync `activeOrder` with refreshed query data so props stay current |
| `src/components/admin/WeeklyScheduleManager.tsx` | (1) Make shift Edit/Delete icons always visible, (2) Decouple shift type presets from time fields |
