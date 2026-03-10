

## Plan: Rename "Rooms" Tab to "Reception" in Admin Operations

### Analysis

This is a simple label rename. The tab already renders `RoomsDashboard` and is gated by `perm: 'rooms'`. Changing the label from "Rooms" to "Reception" requires updating **one line** in the `OPERATIONS` array.

The internal `value: 'rooms'` key and `perm: 'rooms'` stay the same — these are internal identifiers used for tab switching and permission checks. Only the user-facing `label` changes. This will **not break anything**.

### Change

**`src/pages/AdminPage.tsx` — line 69**

```
// Before
{ value: 'rooms', label: 'Rooms', perm: 'rooms' },

// After
{ value: 'rooms', label: 'Reception', perm: 'rooms' },
```

One line, zero risk.

