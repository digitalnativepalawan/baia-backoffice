-- Pre-checkout inspection flow: add required columns

-- Allow locking checkout on a unit while awaiting inspection
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS checkout_locked boolean NOT NULL DEFAULT false;

-- Differentiate housekeeping task types
-- Values: 'pre_checkout_inspection' (before guest leaves) | 'clean_room' (after checkout)
ALTER TABLE public.housekeeping_orders ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'clean_room';

-- Track the inspection result for pre_checkout_inspection tasks
-- Values: 'pending' | 'cleared' | 'issue_flagged'
ALTER TABLE public.housekeeping_orders ADD COLUMN IF NOT EXISTS inspection_status text NOT NULL DEFAULT 'pending';
