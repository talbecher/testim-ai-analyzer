// Supabase client - uses environment variables only.
// Do not hardcode credentials.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || typeof supabaseUrl !== 'string') {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Add it to your .env file or environment variables.'
  );
}

if (!supabaseAnonKey || typeof supabaseAnonKey !== 'string') {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY). Add it to your .env file or environment variables.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
