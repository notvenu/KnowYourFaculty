import getSupabaseServiceClient from "../supabase/server.js";

export const adminDb = getSupabaseServiceClient();
export const adminStorage = null;
export const adminAuth = null;

export default adminDb;
