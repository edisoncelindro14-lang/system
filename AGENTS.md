# Base44 Dev Environment — Mamlakah

## Stack
React 18 + Vite 6 frontend. Backend is the external Supabase project (ref: mtfrvdccubwqdnmnudyu), which is now reachable. A local Postgres + PostgREST stack is also available as a fallback.

## Run
`docker compose -f docker-compose.base44.yml up -d` — starts:
- **db** (postgres:16-alpine) — local database with schema + seed data
- **migrations** (one-shot) — runs `supabase/migrations/000_local_init.sql` on first boot
- **api** (postgrest/postgrest:v12.2.3) — REST API at `/rest/v1/` (Supabase-compatible)
- **proxy** (nginx:alpine) — strips `/rest/v1/` prefix, adds CORS headers, exposed on port 8000
- **web** (node:22) — Vite dev server on host port 3000, bind-mounted with live reload

## Local DB credentials
- Admin login: username `admin`, password `admin123`
- Postgres: user `postgres`, password `postgres`, db `postgres`

## How it works
The app's `src/lib/supabase.js` creates a Supabase client pointing at `VITE_SUPABASE_URL`.

**Currently using the local PostgREST stack** — the real Supabase project is missing the `placement_id` column on the `members` table, which the "Place Here" lobby button needs. The `web` service `environment:` section in `docker-compose.base44.yml` overrides `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to point at the local PostgREST stack. The local DB was seeded with a snapshot of the real Supabase data.

**Vercel placement setup:** Vercel does not apply SQL migrations. Run `supabase/migrations/005_genealogy_placement.sql` in the SQL Editor of the Supabase project used by Vercel; it adds `placement_id` and reloads the REST schema cache. Do not replace placement with `referrer_id`: the sponsor must be preserved.

**Tree interaction:** Canvas pointer capture must exclude interactive controls, otherwise it redirects the "Place Here" click to the canvas. Keep filtered tree arrays memoized so timer ticks do not remount tree nodes during a pointer gesture.

**Position swaps:** `src/lib/genealogyPositions.js` plans a position exchange, reconnecting incoming and child links together. Merely exchanging parents makes ancestor/descendant swaps circular. All relationship directions and full nodes are allowed for authorized admins, including the currently selected top card. Sponsors (`referrer_id`) are preserved; an approved member with no `placement_id` and `tree_level = 0` is a placement root, not a referral fallback. The confirmation explains that downline slots stay at their positions. `placement_order` persists the left-to-right slot, including swaps between siblings; `placementChildren` orders both rendering and swap planning consistently. Apply `supabase/migrations/011_genealogy_position_order.sql` to external Supabase before deploying this change (local Compose applies it automatically). The selected tree stays anchored to the position rather than following the swapped-out member. Run `docker compose -f docker-compose.base44.yml exec -T web node --test src/lib/genealogyPositions.test.js` for regression coverage.

**Change sponsor:** `change_sponsor(p_member_id, p_new_sponsor_id)` in `supabase/migrations/012_change_sponsor_function.sql` atomically updates both referral sponsorship and genealogy placement. Updating only `referrer_id` does not move a member with an existing `placement_id`; a level-zero root also ignores referral fallback. The promoted sponsor takes the member's old incoming slot unless already an ancestor, in which case that ancestor stays in place to avoid a loop. Children retain their owners; affected placement depths and approved-placement child counts are recalculated. Re-selecting the same sponsor repairs an old sponsor-only attachment without rotating the referral pair again. Passing `null` detaches to a level-zero root. The Admin panel awaits member refetch instead of reloading the document. Re-run the UPDATED `012_change_sponsor_function.sql` on external Supabase even if an earlier version was already applied (local Compose applies it automatically). Genealogy renders all saved children rather than silently dropping the ninth and later cards; the eight-slot placement limit remains on the placement controls.

**Sponsor-only attachments:** An approved member with a sponsor (`referrer_id`) but no `placement_id` and `tree_level = 0` is an orphan root — `placementParent()` hides it from its sponsor's genealogy even though `direct_downlines_count` still counts it (the "3/8 in the dropdown but 0/8 in the tree" symptom). `supabase/migrations/013_repair_sponsor_only_attachments.sql` attaches each such member to its sponsor (`placement_id = referrer_id`), skipping any whose sponsor is already a descendant (a member swapped into the root slot keeps its sponsor but must stay a root), then refreshes tree levels and downline counts. Re-run it on external Supabase after deploying (local Compose applies it automatically); it is idempotent.

**Restoration:** Account approval and maintenance activation are separate. Restoring sets `status = approved` immediately, keeps placement, and sets the existing red maintenance override with cleared custom timers. It does not run placement approval or distribute commissions. Older databases may lack `deleted_date`; only that missing-column error should trigger the timestamp-free retry.

**To switch back to the real Supabase:** run migration `005_genealogy_placement.sql` (or the SQL below followed by `notify pgrst, 'reload schema'`) on the Supabase dashboard SQL editor, then remove the two override lines from the `web` service `environment:` section:
```sql
alter table public.members add column if not exists placement_id uuid references public.members(id) on delete set null;
create index if not exists idx_members_placement on public.members(placement_id);
```

**If the external Supabase becomes unreachable again:** add `VITE_SUPABASE_URL=https://8000-${BASE44_PUBLIC_HOST_SUFFIX}` and a valid PostgREST JWT as `VITE_SUPABASE_ANON_KEY` to the `web` service `environment:` section in `docker-compose.base44.yml` to fall back to the local PostgREST stack.

## Shared maintenance countdown
- `MaintenanceProvider` inside the layout supplies one maintenance status, one clock, and refreshed member/code data to the top banner and Code Cabinet. Keep the cabinet's monthly monitor on this shared status; calendar-month totals must not determine its maintenance timer or activation state.
- The Store panel's Monthly Redeemed Codes also consumes the provider's member/code data and clock. Each row calls `maintenanceStatus` for that member at the shared timestamp; selecting a username switches the Active/Not Active summary to that member. Without a filter, the summary shows the signed-in store's own countdown, matching their Code Cabinet.
- Verify `/CodeCabinet` and `/Store` while signed in as a store: the banner, applicable Active/Not Active summary, and own row countdown must have identical remaining seconds across ticks. In the store monitor, filter a designated member and compare their summary and row with that member's Code Cabinet; historical month navigation must not reset maintenance. The other summary is zero; monthly redemption totals remain separate.

## Verify
- `curl -sf http://localhost:3000/` returns the landing page HTML
- Login at `/MemberLogin` with member credentials from the local DB (e.g. `Ceferinoarizobal` / `M12345678`) → navigates to `/Dashboard`
- The "Place Here" button on the Genealogy/Tree page works: it opens a modal, places the lobby member, and they appear in the tree
