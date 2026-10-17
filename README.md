# Mamlakah

GitHub/Vercel/Supabase rebuild of the Mamlakah Network System.

## Stack

- React + Vite
- Supabase PostgreSQL/Auth/Realtime/Storage
- Vercel
- Tailwind-style responsive CSS
- Lucide React

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Run `supabase/migrations/002_redeem_function.sql`.
4. Deploy the `redeem-maintenance-code` Edge Function.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel.
6. Run `npm install`.
7. Run `npm run dev`.
8. Push to GitHub and connect the repository to Vercel.

## Genealogy / Supabase troubleshooting

Frontend deployments do **not** apply SQL migrations. For an existing Supabase database, run the current `supabase/migrations/012_change_sponsor_function.sql` in that project's SQL Editor; it includes the placement columns/index and installs the atomic sponsor-transfer function. It is safe to re-run and does not recreate member accounts. If old approved sponsor-only members are still missing, review and run `013_repair_sponsor_only_attachments.sql` separately. No RLS policies need to be disabled or broadened for this setup fix.

The latest placement always replaces the old one on the same member account. Admin and tree transfers allow any other member as the new upline. If the selected upline is currently below the member, it is detached to a root first (preserving its referral sponsor), then the member and remaining downline move below it. This also resolves existing circular target ancestry instead of hiding the tree behind a repair warning. Both saved links and cycle-free ancestry are read back before success. A conditional preparation/rollback path supports older deployed RPCs, but re-run the latest `012_change_sponsor_function.sql` for fully atomic, serialized database transfers under concurrent editing. Untouched historic cycles are not automatically rewritten by viewing a page; migration 014 is an optional historic cleanup, not required to save a new placement. Missing functions/columns name the migration to apply; permission errors remain errors. Position swaps remain a separate operation.

### Base44 sandbox database

`docker compose -f docker-compose.base44.yml up -d --build` starts live source on port 3000. The sandbox-only `.env.base44-defaults` points to local PostgREST; it is **not** a copy of the external Supabase database. Real project credentials supplied securely through Base44 (`/run/base44/app.env`, last in `env_file`) override these defaults. Supply **both** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the same project. Neither key is forced under Compose `environment`, so dashboard changes can take effect; never put a service-role key in a `VITE_` variable. Vercel must have the same pair in its own environment and be redeployed after environment changes.

This fallback is confined to the Base44 Compose setup and does not use a shared-code preview override: with `BASE44_PREVIEW_MODE` unset, production still uses its own Vite environment. Member-query caches are scoped to the configured database URL to prevent stale local members appearing after switching projects. Local migrations run in the one-shot `migrations` service; they never install changes in external Supabase.

Checks: `docker compose -f docker-compose.base44.yml exec -T web node --test src/lib/genealogyPositions.test.js src/lib/placementMoves.test.js src/lib/sponsorTransfer.test.js`, then `docker compose -f docker-compose.base44.yml exec -T web npm run build`. For signed-in verification, change a disposable member's sponsor in Admin, open the new sponsor in Genealogy, and verify it appears once and is gone from the old sponsor; remove only the disposable records afterward.

## Security

Never commit `.env` files or the Supabase service-role key.

The included frontend is a functional foundation. Admin CRUD, complete five-level recursive genealogy UI, withdrawal approval UI, CSV import/export, receipt upload UI, and role-management screens should be completed against the protected database functions before production launch.

## Important

The original Base44 specification described plaintext passwords. This rebuild deliberately does not store plaintext passwords. Use Supabase Auth and server-side Edge Functions for authentication and sensitive operations.
