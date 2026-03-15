import { createClient } from "@supabase/supabase-js";
import clientConfig from "../../config/client.js";

const supabaseUrl = String(clientConfig.supabaseUrl || "").trim();
const supabaseAnonKey = String(clientConfig.supabaseAnonKey || "").trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
