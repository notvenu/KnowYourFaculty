import { createClient } from "@supabase/supabase-js";
import serverConfig from "../../config/server.js";

let serviceClient = null;

export function getSupabaseServiceClient() {
  if (serviceClient) return serviceClient;

  const url = String(serverConfig.supabaseUrl || "").trim();
  const serviceRoleKey = String(serverConfig.supabaseServiceRoleKey || "").trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}

export default getSupabaseServiceClient;
