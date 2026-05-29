import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient | null = null;

function resolveSupabaseCredentials() {
  const supabaseUrl = process.env.DATABASE_URL || "";
  // Using service key for backend admin operations (bypassing RLS entirely for our secure workers)
 
  if (!supabaseUrl) {
    throw new Error(
      "Supabase credentials are missing. Set DATABASE_URL."
    );
  }

  return { supabaseUrl };
}

export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const { supabaseUrl } = resolveSupabaseCredentials();

    supabaseAdminClient = createClient(supabaseUrl, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseAdminClient;
}
