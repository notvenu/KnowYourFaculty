import clientConfig from "../config/client.js";
import { supabase } from "../lib/supabase/client.js";
import { throwIfSupabaseError } from "../lib/supabase/helpers.js";

const WEBSITE_FEEDBACK_TABLE =
  clientConfig.supabaseWebsiteFeedbackTable || "website_feedback";

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

class WebsiteFeedbackService {
  table = WEBSITE_FEEDBACK_TABLE;

  async submitFeedback({
    authUserId,
    appUserId,
    email,
    rating,
    suggestions,
    pagePath,
  }) {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const safeAuthUserId = String(authUserId || "").trim();
    const safeAppUserId = String(appUserId || "").trim();
    const safeRating = clampRating(rating);
    if (!safeRating) {
      throw new Error("Invalid rating.");
    }
    if (!safeAuthUserId) {
      throw new Error("Missing authenticated user for feedback.");
    }

    const timestamp = new Date().toISOString();
    const payload = {
      rating: safeRating,
      suggestions: String(suggestions || "").trim() || null,
      page_path: String(pagePath || "").trim() || null,
      created_at: timestamp,
      updated_at: timestamp,
      user_email: String(email || "").trim() || null,
      app_user_id: safeAppUserId || null,
      auth_user_id: safeAuthUserId,
    };

    const { data, error } = await supabase
      .from(this.table)
      .upsert(payload, { onConflict: "auth_user_id" })
      .select("id")
      .single();

    throwIfSupabaseError(error, "Failed to submit website feedback.");
    return data || null;
  }

  async getAllFeedback() {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase
      .from(this.table)
      .select(
        "id, auth_user_id, app_user_id, user_email, rating, suggestions, page_path, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    throwIfSupabaseError(error, "Failed to fetch website feedback.");
    return data || [];
  }
}

const websiteFeedbackService = new WebsiteFeedbackService();
export default websiteFeedbackService;
