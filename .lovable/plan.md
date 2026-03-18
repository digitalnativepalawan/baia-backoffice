

## Plan: Create 6 Resort Operations Edge Functions

### Overview
Create 6 new Supabase Edge Functions that query existing database tables and return clean JSON. All follow the same pattern as `today-ops` (CORS headers, service role client, no JWT verification).

### Table-to-Endpoint Mapping

| Endpoint | Tables Queried |
|---|---|
| `orders-today` | `orders` (filtered today, active statuses), joined to `units` via `room_id` |
| `frontdesk-today` | `resort_ops_bookings` + `resort_ops_guests` + `resort_ops_units` + `units` |
| `housekeeping` | `housekeeping_orders` (active statuses) |
| `admin-summary` | `orders` (today revenue), `resort_ops_bookings` (unpaid/occupancy), `units` |
| `tours-today` | `tour_bookings` (today) OR `guest_tours` (today) |
| `guest-requests` | `guest_requests` (non-completed) |

### Files Created (6)

1. **`supabase/functions/orders-today/index.ts`**
   - Query `orders` where `created_at >= today` and `status in ('New','Preparing','Served')`
   - Join `units` via `room_id` for room name, fall back to `location_detail` + `order_type`
   - Extract item names from `items` JSON array
   - Map status: New→pending, Preparing→preparing, Served→served

2. **`supabase/functions/frontdesk-today/index.ts`**
   - Arrivals: `resort_ops_bookings.check_in = today`, not checked out
   - Departures: `resort_ops_bookings.check_out = today`
   - In-house: bookings spanning today with `checked_in_at` set, not checked out
   - Room status counts from `units` table (`status` field: ready/available, occupied, needs_cleaning/dirty/to_clean)

3. **`supabase/functions/housekeeping/index.ts`**
   - Query `housekeeping_orders` where status not in ('completed','cancelled')
   - Map fields: `unit_name`→room, `status`, `accepted_by_name`/`cleaning_by_name`→assigned_staff, `cleaning_notes`/`damage_notes`→notes

4. **`supabase/functions/admin-summary/index.ts`**
   - `total_revenue_today`: sum of `orders.total` where status='Closed' and `closed_at` is today
   - `unpaid_balances`: sum of `(room_rate - paid_amount)` from active `resort_ops_bookings`
   - `occupancy_rate`: occupied units / total active units × 100
   - `alerts`: list unpaid bookings by guest+room name

5. **`supabase/functions/tours-today/index.ts`**
   - Query `tour_bookings` where `tour_date = today`
   - Map: `guest_name`, `tour_name`→tour_type, `pickup_time`→time, `confirmed_by`→assigned_driver, `status`

6. **`supabase/functions/guest-requests/index.ts`**
   - Query `guest_requests` where status != 'completed'
   - Map: derive room from `room_id` join to `units`, `request_type`→request, `details`, `status`
   - Priority: default 'medium' (no priority column exists — use 'high' if status is 'pending' and older than 2 hours, else 'medium')
   - `confirmed_by`→assigned_staff

### File Modified (1)

- **`supabase/config.toml`** — add `verify_jwt = false` for all 6 new functions

### Auth Pattern
All functions use the identical boilerplate from `today-ops`:
- CORS headers with OPTIONS preflight
- `createClient` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- No JWT verification (public read endpoints)

