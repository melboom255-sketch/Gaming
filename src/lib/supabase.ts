import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasRealUrl =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id');

const hasRealKey =
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes('your-public-supabase-anon-key');

export const isSupabaseConfigured = Boolean(hasRealUrl && hasRealKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
