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

**Database selection:** `.env.base44-defaults` supplies sandbox-only local PostgREST values. `/run/base44/app.env` is loaded last and wins; never put `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` under Compose `environment:` because it silently overrides dashboard credentials. Supply both from the same Supabase project to switch. The local database is separate, not a live mirror (currently only the seeded admin). External Supabase is reachable but its schema is NOT verified without credentials. See README for setup; no shared-code preview flag override is used.

**Vercel placement setup:** Vercel does not apply SQL migrations. Run `supabase/migrations/005_genealogy_placement.sql` in the SQL Editor of the Supabase project used by Vercel; it adds `placement_id` and reloads the REST schema cache. Do not replace placement with `referrer_id`: the sponsor must be preserved.

**Tree interaction:** Canvas pointer capture must exclude interactive controls, otherwise it redirects the "Place Here" click to the canvas. Keep filtered tree arrays memoized so timer ticks do not remount tree nodes during a pointer gesture.

**Position swaps:** `src/lib/genealogyPositions.js` plans a position exchange, reconnecting incoming and child links together. Merely exchanging parents makes ancestor/descendant swaps circular. All relationship directions and full nodes are allowed for authorized admins, including the currently selected top card. Sponsors (`referrer_id`) are preserved; an approved member with no `placement_id` and `tree_level = 0` is a placement root, not a referral fallback. The confirmation explains that downline slots stay at their positions. `placement_order` persists the left-to-right slot, including swaps between siblings; `placementChildren` orders both rendering and swap planning consistently. Apply `supabase/migrations/011_genealogy_position_order.sql` to external Supabase before deploying this change (local Compose applies it automatically). The selected tree stays anchored to the position rather than following the swapped-out member. Run `docker compose -f docker-compose.base44.yml exec -T web node --test src/lib/genealogyPositions.test.js` for regression coverage.

**Change sponsor:** `change_sponsor(p_member_id, p_new_sponsor_id)` in migration 012 replaces both `referrer_id` and `placement_id` on the existing member, never inserts a copy. Any other member can be the new upline, including a descendant. If that would make a loop, the selected upline is first lifted to a root (its referral sponsor is preserved), then the moved member and remaining downline attach below it. The latest SQL serializes graph edits, recalculates affected depths and counts, and compacts old/new sibling slots atomically. Passing `null` detaches to a level-zero root with no slot. Re-run the updated 012 in external Supabase for database-side concurrency protection; local Compose only updates its own database. Admin awaits refetch rather than reloading the document.

**Sponsor-only attachments:** An approved member with a sponsor (`referrer_id`) but no `placement_id` and `tree_level = 0` is an orphan root — `placementParent()` hides it from its sponsor's genealogy even though `direct_downlines_count` still counts it (the "3/8 in the dropdown but 0/8 in the tree" symptom). `supabase/migrations/013_repair_sponsor_only_attachments.sql` attaches each such member to its sponsor (`placement_id = referrer_id`), skipping any whose sponsor is already a descendant (a member swapped into the root slot keeps its sponsor but must stay a root), then refreshes tree levels and downline counts. Re-run it on external Supabase after deploying (local Compose applies it automatically); it is idempotent.

**Placement cycles:** Do not reinstate the blocking "Placement repair required" screen or reject ancestor-to-descendant transfers. A save resolves circular target ancestry by detaching the selected upline first; moving a member out of an existing cycle replaces its old link. Genealogy renders the tree with an ancestor guard and excludes ancestor cards from child slots, so a node cannot repeat inside the same view. Untouched historic cycles are not silently rewritten on page load. Migration 014 remains an optional historic repair script; it is not a prerequisite to move a member in the UI, and Compose does not currently run it.

**Restoration:** Account approval and maintenance activation are separate. Restoring sets `status = approved` immediately, keeps placement, and sets the existing red maintenance override with cleared custom timers. It does not run placement approval or distribute commissions. Older databases may lack `deleted_date`; only that missing-column error should trigger the timestamp-free retry.

**External Supabase setup:** Run the current `012_change_sponsor_function.sql` in that project's SQL Editor (now includes placement column/index prerequisites and a transaction), then supply its matching URL/public key through secure secrets. Local Compose migrations never apply remotely. If needed, review/run `013_repair_sponsor_only_attachments.sql` separately for historic orphan attachments. Do not disable RLS or use a service-role key in the frontend.

**Transfer safety:** `planUplineDetachment` in `src/lib/placementMoves.js` supports existing remote RPC versions: read fresh placement links, conditionally detach only a descendant/circular target's placement (not its sponsor), refresh its affected levels/slots/counts, then call `change_sponsor`. Preparatory failures and rejected RPCs restore completed preparation writes using expected-value filters, never blindly overwrite concurrent edits. Saved links and cycle-free ancestry are read back before success. This multi-request compatibility path is not a substitute for the latest SQL's transaction/locking under concurrent editors. Do not modify unrelated existing members during verification: use disposable roots, a moved member and its leaf; repeat moves, move a root below its leaf, and check latest placement, no old copy, levels and counts. Remove only IDs returned by your test creation. Regression command: `node --test src/lib/genealogyPositions.test.js src/lib/placementMoves.test.js src/lib/sponsorTransfer.test.js` in the web container.

**Transfer save failures:** Both Admin and genealogy drag/drop call `transferSponsor` in `src/lib/sponsorTransfer.js`. It prepares a necessary upline detachment, calls the transfer RPC, and reads back both saved links before success; missing schema/function errors explicitly name migration 012, while permission errors remain errors. A lost/unconfirmed RPC response must not blindly restore the detached target: the move may already have committed, and restoring that old edge could recreate a cycle. The old drag flow ignored failed writes, changed placement without sponsorship, and miscalculated descendant levels. Query caches now include the Supabase URL, so switching databases cannot reuse a member snapshot from a different project. Test the helper with `node --test src/lib/sponsorTransfer.test.js` in the web container.

## Shared maintenance countdown
- `MaintenanceProvider` inside the layout supplies one maintenance status, one clock, and refreshed member/code data to the top banner and Code Cabinet. Keep the cabinet's monthly monitor on this shared status; calendar-month totals must not determine its maintenance timer or activation state.
- The Store panel's Monthly Redeemed Codes also consumes the provider's member/code data and clock. Each row calls `maintenanceStatus` for that member at the shared timestamp; selecting a username switches the Active/Not Active summary to that member. Without a filter, the summary shows the signed-in store's own countdown, matching their Code Cabinet.
- Verify `/CodeCabinet` and `/Store` while signed in as a store: the banner, applicable Active/Not Active summary, and own row countdown must have identical remaining seconds across ticks. In the store monitor, filter a designated member and compare their summary and row with that member's Code Cabinet; historical month navigation must not reset maintenance. The other summary is zero; monthly redemption totals remain separate.

## Verify
- `curl -sf http://localhost:3000/` returns the landing page HTML
- Login at `/MemberLogin` with member credentials from the local DB (e.g. `Ceferinoarizobal` / `M12345678`) → navigates to `/Dashboard`
- The "Place Here" button on the Genealogy/Tree page works: it opens a modal, places the lobby member, and they appear in the tree
