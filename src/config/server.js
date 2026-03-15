import { config } from "dotenv";

config();

const readServerEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (String(value || "").trim()) return value;
  }
  return undefined;
};

const serverConfig = {
  supabaseUrl: readServerEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
  supabaseAnonKey: readServerEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ),
  supabaseServiceRoleKey: readServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseFacultyTable:
    readServerEnv("SUPABASE_FACULTY_TABLE", "VITE_SUPABASE_FACULTY_TABLE") ||
    "faculty",
  supabaseReviewTable:
    readServerEnv("SUPABASE_REVIEW_TABLE", "VITE_SUPABASE_REVIEW_TABLE") ||
    "reviews",
  supabaseCoursesTable:
    readServerEnv("SUPABASE_COURSES_TABLE", "VITE_SUPABASE_COURSES_TABLE") ||
    "courses",
  supabasePollTable:
    readServerEnv("SUPABASE_POLL_TABLE", "VITE_SUPABASE_POLL_TABLE") ||
    "polls",
  supabasePollVotesTable:
    readServerEnv(
      "SUPABASE_POLL_VOTES_TABLE",
      "VITE_SUPABASE_POLL_VOTES_TABLE",
    ) || "poll_votes",
  supabaseDeleteAccountRpc:
    readServerEnv(
      "SUPABASE_DELETE_ACCOUNT_RPC",
      "VITE_SUPABASE_DELETE_ACCOUNT_RPC",
    ) || "delete_my_account",
  cloudinaryCloudName: readServerEnv(
    "CLOUDINARY_CLOUD_NAME",
    "VITE_CLOUDINARY_CLOUD_NAME",
  ),
  cloudinaryApiKey: readServerEnv("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: readServerEnv("CLOUDINARY_API_SECRET"),
  cloudinaryFolder:
    readServerEnv("CLOUDINARY_FOLDER", "VITE_CLOUDINARY_FOLDER") ||
    "faculty_photos",
  cloudinaryUploadPreset: readServerEnv(
    "CLOUDINARY_UPLOAD_PRESET",
    "VITE_CLOUDINARY_UPLOAD_PRESET",
  ),
  authToken: readServerEnv("AUTH_TOKEN", "VITE_AUTH_TOKEN"),
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || "development",
  },
  scraper: {
    apiUrl: "https://vtopcc.vit.ac.in/vtop/content/listFacultyContent",
    batchSize: 50,
    retryAttempts: 3,
    timeout: 30000,
  },
};

export default serverConfig;
