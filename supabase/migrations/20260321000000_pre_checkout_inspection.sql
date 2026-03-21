-- Add checkout_locked to units table
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS checkout_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Add task_type to housekeeping_orders (pre_checkout_inspection | clean_room)
ALTER TABLE public.housekeeping_orders ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'clean_room';

-- Add inspection_status to housekeeping_orders (pending | cleared | issue_flagged)
ALTER TABLE public.housekeeping_orders ADD COLUMN IF NOT EXISTS inspection_status TEXT NOT NULL DEFAULT 'pending';
