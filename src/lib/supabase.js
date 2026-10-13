import { createClient } from "@supabase/supabase-js";

// Detect and correct swapped env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey && !supabaseUrl.match(/^https?:\/\//i) && supabaseKey.match(/^https?:\/\//i)) {
  [supabaseUrl, supabaseKey] = [supabaseKey, supabaseUrl];
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});