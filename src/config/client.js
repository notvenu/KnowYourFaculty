/**
 * Client configuration shared by the Vite frontend and browser-side helpers.
 */

// Each variable is read with a static `import.meta.env.VITE_X` so Vite bundles only the names listed
// here. A dynamic `import.meta.env[key]` would inline every VITE_ variable (including secrets by mistake).
// In Node (`import.meta.env` is undefined) the read throws and falls back to process.env.
const viteEnv = {
  VITE_SUPABASE_URL: () => import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: () => import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_FACULTY_TABLE: () => import.meta.env.VITE_SUPABASE_FACULTY_TABLE,
  VITE_SUPABASE_REVIEW_TABLE: () => import.meta.env.VITE_SUPABASE_REVIEW_TABLE,
  VITE_SUPABASE_COURSES_TABLE: () => import.meta.env.VITE_SUPABASE_COURSES_TABLE,
  VITE_SUPABASE_POLL_TABLE: () => import.meta.env.VITE_SUPABASE_POLL_TABLE,
  VITE_SUPABASE_POLL_VOTES_TABLE: () => import.meta.env.VITE_SUPABASE_POLL_VOTES_TABLE,
  VITE_SUPABASE_WEBSITE_FEEDBACK_TABLE: () => import.meta.env.VITE_SUPABASE_WEBSITE_FEEDBACK_TABLE,
  VITE_SUPABASE_DELETE_ACCOUNT_RPC: () => import.meta.env.VITE_SUPABASE_DELETE_ACCOUNT_RPC,
  VITE_CLOUDINARY_CLOUD_NAME: () => import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  VITE_CLOUDINARY_FOLDER: () => import.meta.env.VITE_CLOUDINARY_FOLDER,
  VITE_CLOUDINARY_UPLOAD_PRESET: () => import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  VITE_SITE_URL: () => import.meta.env.VITE_SITE_URL,
  VITE_ADMIN_EMAILS: () => import.meta.env.VITE_ADMIN_EMAILS,
  VITE_EXPLICIT_ALLOWED_EMAILS: () => import.meta.env.VITE_EXPLICIT_ALLOWED_EMAILS,
};

const getEnv = (key) => {
  try {
    return viteEnv[key]();
  } catch {
    return process.env[key];
  }
};

const clientConfig = {
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseFacultyTable: getEnv("VITE_SUPABASE_FACULTY_TABLE") || "faculty",
  supabaseReviewTable: getEnv("VITE_SUPABASE_REVIEW_TABLE") || "reviews",
  supabaseCoursesTable: getEnv("VITE_SUPABASE_COURSES_TABLE") || "courses",
  supabasePollTable: getEnv("VITE_SUPABASE_POLL_TABLE") || "polls",
  supabasePollVotesTable:
    getEnv("VITE_SUPABASE_POLL_VOTES_TABLE") || "poll_votes",
  supabaseWebsiteFeedbackTable:
    getEnv("VITE_SUPABASE_WEBSITE_FEEDBACK_TABLE") || "website_feedback",
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
