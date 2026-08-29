import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eoewkjfgqivrkkgpjsrk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_b9sZUgW7Sr2WItAxEqCoyw_gc-xoJyl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
