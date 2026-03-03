// Infrastructure: Supabase client singleton
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client (anon key) — for use in client components
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Service client (service role) — for use in server-side routes only
export const supabaseService = createClient(
    supabaseUrl,
    supabaseServiceKey ?? supabaseAnonKey,
    { auth: { persistSession: false } }
);
