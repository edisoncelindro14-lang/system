import { createClient } from "@supabase/supabase-js";

// Detect and correct swapped env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey && !supabaseUrl.match(/^https?:\/\//i) && supabaseKey.match(/^https?:\/\//i)) {
  [supabaseUrl, supabaseKey] = [supabaseKey, supabaseUrl];
}

// Fall back to placeholder values when env vars are missing (e.g. Vercel preview
// without configured secrets). Without this, createClient(undefined, undefined)
// throws at module-evaluation time and crashes the entire JS bundle before React
// mounts — the page is blank and the Vercel preview screenshot shows nothing.
// The public Landing page doesn't use Supabase and renders fine with placeholders;
// Supabase-dependent routes fail gracefully at request time instead.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-anon-key",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  },
);