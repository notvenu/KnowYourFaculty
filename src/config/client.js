/**
 * Client configuration shared by the Vite frontend and browser-side helpers.
 */

const getEnv = (key) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }
  return process.env[key];
};

const clientConfig = {
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseFacultyTable:
    getEnv("VITE_SUPABASE_FACULTY_TABLE") || "faculty",
  supabaseReviewTable:
    getEnv("VITE_SUPABASE_REVIEW_TABLE") || "reviews",
  supabaseCoursesTable:
    getEnv("VITE_SUPABASE_COURSES_TABLE") || "courses",
  supabasePollTable: getEnv("VITE_SUPABASE_POLL_TABLE") || "polls",
  supabasePollVotesTable:
    getEnv("VITE_SUPABASE_POLL_VOTES_TABLE") || "poll_votes",
  supabaseDeleteAccountRpc:
    getEnv("VITE_SUPABASE_DELETE_ACCOUNT_RPC") || "delete_my_account",
  cloudinaryCloudName: getEnv("VITE_CLOUDINARY_CLOUD_NAME"),
  cloudinaryFolder: getEnv("VITE_CLOUDINARY_FOLDER") || "faculty_photos",
  cloudinaryUploadPreset: getEnv("VITE_CLOUDINARY_UPLOAD_PRESET"),
  siteUrl: getEnv("VITE_SITE_URL"),
  adminEmails: String(getEnv("VITE_ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  explicitAllowedEmails: String(getEnv("VITE_EXPLICIT_ALLOWED_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  app: {
    name: "Know Your Faculty",
    version: "1.0.0",
    description: "VIT-AP Faculty Directory",
  },
};

export default clientConfig;
