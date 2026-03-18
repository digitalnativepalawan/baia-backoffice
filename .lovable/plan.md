

## Plan: Add "Live Ops" Tab to Admin Page

### What

Create a new "Live Ops" tab in the Admin page that connects to 3 external API endpoints and displays a dashboard with today's operations, guest search, and a 7-day forecast.

### Architecture

**New files:**
- `src/components/admin/LiveOpsDashboard.tsx` — main dashboard component with 3 sections

**Modified files:**
- `src/pages/AdminPage.tsx` — add `live-ops` tab definition and TabsContent

### Tab placement

Add to the `OPERATIONS` array (after Housekeeping):
```
{ value: 'live-ops', label: 'Live Ops', perm: null }
```
`perm: null` means admin-only access, matching audit/archive pattern.

### LiveOpsDashboard component

Three sections, each fetching from the external API:

1. **Today's Ops** (`GET /today-ops`)
   - Cards showing arrival count, departure count, occupied/available rooms
   - Tables for arrivals, departures, pending orders, unpaid reservations

2. **Guest Search** (`GET /guest-search?name=...`)
   - Search input (min 2 chars)
   - Results showing guest info, booking history, and spending summary

3. **7-Day Forecast** (`GET /forecast-7day`)
   - Daily cards showing occupancy %, arrivals, departures, expected revenue
   - Issues/warnings highlighted per day

### API integration

- Base URL: `https://rukgsweczvwowxrrcapy.supabase.co/functions/v1`
- Auth header with the provided Bearer token (this is a public anon key, so it's fine to store in code)
- Use `@tanstack/react-query` for data fetching with auto-refresh (today-ops and forecast every 60s)
- Guest search uses debounced input

### UI patterns

Follow existing admin tab conventions: Card layouts, tables, badges, and the same typography/spacing used throughout AdminPage.

