

## Plan: Add Role Templates to Staff Access Manager

### What
Add a "Role" dropdown next to each employee name in the Staff Access Manager. Selecting a role (e.g., Receptionist, Cook, Bartender) auto-applies a predefined set of permissions, replacing manual per-section toggling.

### Role Templates and Their Permissions

| Role | Permissions granted |
|------|-------------------|
| **Admin** | `admin` (full access) |
| **GM** | `admin` (full access) |
| **Receptionist** | `reception:edit`, `experiences:edit`, `rooms:edit`, `housekeeping:view`, `orders:view`, `documents:view` |
| **Cook** | `kitchen:edit`, `orders:view`, `inventory:view` |
| **Chef** | `kitchen:edit`, `menu:edit`, `orders:edit`, `inventory:edit` |
| **Bartender / Barista** | `bar:edit`, `orders:view`, `inventory:view` |
| **Tours** | `experiences:edit`, `orders:view` |
| **Transportation** | `experiences:view`, `tasks:edit` |
| **Maintenance** | `resort_ops:edit`, `tasks:edit`, `housekeeping:view` |
| **Landscaping** | `tasks:edit`, `resort_ops:view` |

### Changes

**`src/components/admin/StaffAccessManager.tsx`**:
1. Define a `ROLE_TEMPLATES` map with role name → array of permission strings
2. Add a role selector (dropdown or button row) above the admin toggle for each employee
3. When a role is selected:
   - Delete all existing `employee_permissions` rows for that employee
   - Insert all permissions from the template
   - Invalidate queries, show toast
4. Individual permission badges remain below for fine-tuning after role selection
5. No database changes needed -- uses existing `employee_permissions` table

### Technical Details
- Role is not stored as a column; it's a UI shortcut that bulk-sets permissions
- After applying a role, individual badges update to reflect the new state
- The granular toggles still work for customization on top of the template

