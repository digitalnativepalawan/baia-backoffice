ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.orders.delivery_type IS
  'For guest-portal orders: ''room_delivery'' = bring to room, ''dine_in'' = guest will eat at restaurant. NULL for staff-placed orders.';
