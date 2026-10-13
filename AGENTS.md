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

**To switch back to the real Supabase:** run migration `005_genealogy_placement.sql` (or the SQL below followed by `notify pgrst, 'reload schema'`) on the Supabase dashboard SQL editor, then remove the two override lines from the `web` service `environment:` section:
```sql
alter table public.members add column if not exists placement_id uuid references public.members(id) on delete set null;
create index if not exists idx_members_placement on public.members(placement_id);
```

**If the external Supabase becomes unreachable again:** add `VITE_SUPABASE_URL=https://8000-${BASE44_PUBLIC_HOST_SUFFIX}` and a valid PostgREST JWT as `VITE_SUPABASE_ANON_KEY` to the `web` service `environment:` section in `docker-compose.base44.yml` to fall back to the local PostgREST stack.

## Verify
- `curl -sf http://localhost:3000/` returns the landing page HTML
- Login at `/MemberLogin` with member credentials from the local DB (e.g. `Ceferinoarizobal` / `M12345678`) → navigates to `/Dashboard`
- The "Place Here" button on the Genealogy/Tree page works: it opens a modal, places the lobby member, and they appear in the tree
