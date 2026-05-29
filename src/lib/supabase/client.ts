import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient | null = null;

function resolveSupabaseCredentials() {
  const supabaseUrl = process.env.DATABASE_URL || "";
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || "";
  // Using service key for backend admin operations (bypassing RLS entirely for our secure workers)
 
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase credentials are missing. Set DATABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_KEY."
    );
  }

  return { supabaseUrl, supabaseServiceKey };
}

export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const { supabaseUrl, supabaseServiceKey } = resolveSupabaseCredentials();

    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseAdminClient;
}
