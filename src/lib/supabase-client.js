import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient;

export function hasSupabaseCredentials() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseClient() {
  if (!hasSupabaseCredentials()) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}
