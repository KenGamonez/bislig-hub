# Bislig Hub — Protected System Contract

Lightweight protection so one-at-a-time bug fixes cannot accidentally break
already-working systems. Read this before changing anything.

## Rule 0 — Scope discipline

A fix must remain within its declared scope. If a fix requires changing a
protected area outside that scope, STOP and report the dependency instead
of modifying it.

## 1. Protected areas (do not change unless the task explicitly says so)

### Authentication
- Driver login (`src/legacy/components/DriverLogin.tsx`, `/driver/login`)
- Username resolution (`resolve_driver_credentials`, `signInDriverWithIdentifier`)
- Admin authentication (`AdminLogin`, org `OrgLogin`)
- Single-account behavior (one auth user → at most one driver; driver-first,
  admin-fallback identity resolution)

### Organizations
- `organizations`, `organization_members`, `organization_admins`
- Authorization boundary: org admins act only within administered orgs
  (`is_org_admin_for_driver`, membership joins); NULL-org rows are
  Founder-only; other orgs and independents are unreachable by design

### Ride Now
- Dispatch (`dispatch_ride`), offers (`ride_offers` lifecycle),
  presence (`driver_locations`), ride lifecycle (`advance_ride_status`),
  cancellation (`cancel_ride`), ratings (`ride_ratings`)

### Pakyawan
- Booking, driver assignment/pool, negotiation (driver price + admin quote),
  lifecycle (`advance_pakyawan_status`), cancellation ledger

### Pa-deliver
- Booking, offers, proof-gated completion (`complete_delivery_with_proof`),
  lifecycle, ratings, cancellations

### Founder controls
- Driver applications review + provisioning chain
- Global admin (`app_metadata.role = 'admin'`)
- `organizations` / `organization_admins` row management
- Cross-organization monitoring and destructive actions

### Security
- RLS deny-boundaries (anon gets nothing sensitive; members see own rows;
  org admins see own org; platform sees all)
- SECURITY DEFINER RPC boundaries (explicit allowlists, `set search_path`,
  EXECUTE to `authenticated` only, never anon)
- Organization scoping (membership joins; never `org_id` stamped on
  transport tables; never client-supplied identity trusted)
- Founder-only controls (auth administration, org creation, full deletion)

## 2. Migration discipline

Applied Supabase migrations must never be edited. Every future DB change
requires a NEW timestamped migration under `supabase/migrations/` that is
additive, idempotent (`if not exists` / `or replace` / guarded DO blocks),
and scoped to the task. Verify live objects with read-only probes
(anon 401 = exists-but-denied; 404 = absent) — never with test data.

## 3. Shared / high-risk files (touching these triggers expanded checks)

`src/App.tsx` (all routes), `src/org/orgData.ts`, `src/legacy/lib/driverAuth.ts`,
`src/legacy/lib/supabase.ts`, `src/lib/supabase.ts`, `src/driver/hooks/useDriverSession.ts`,
`src/driver/DriverShell.tsx`, `src/org/OrgShell.tsx`, `src/org/OrgGuard.tsx`,
`src/org/useOrgAdmin.ts`, `package.json`, `vercel.json`, any file under
`supabase/migrations/`. Expanded checks: full `tsc + lint + build`, route
smoke test on the built app, `git diff --stat` review proving no out-of-scope
files changed, and (for migrations) the dashboard verification queries.

## 4. Every completed fix ends with (no exceptions)

1. `npx tsc -b`, `npm run lint`, `npm run build` — all green
2. `npm run guardrails` — structural contract holds
3. `git status` / `git diff --stat` — only intended files changed
4. Commit with a focused message → push `origin/master`
5. Deploy to the EXISTING `bislig-hub-app` project only (CLI path; the
   project has no GitHub auto-deploy link — pushing alone deploys nothing)
6. Live verification: HTTP 200s + production bundle contains the change
7. Report: files changed, commit, deployment ID/URL, verification results

## 5. DB contract checks that cannot run in CI (documented, not automated)

No production credentials exist in this repo by design, so these stay
manual, read-only, and credential-free:
- Object existence via anon PostgREST probes (401 = exists+denied, 404 =
  absent; `resolve_driver_credentials` control must stay 200)
- Column checks via select-a-known-column (401) vs bogus column (400)
- Grants/RLS/policies/publication/cron via Supabase dashboard SQL editor
  catalog queries (`pg_proc`, `pg_policies`, `pg_publication_tables`,
  `cron.job`, `information_schema`)
- Never create test users, drivers, applications, rides, or bookings to
  verify behavior; never guess or handle real passwords
