/**
 * 🌐 CLIENT CONFIGURATION
 * For React/Vite frontend components
 * Uses import.meta.env for Vite environment variables
 */

const clientConfig = {
  appwriteUrl: import.meta.env.VITE_APPWRITE_URL,
  appwriteProjectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  appwriteDBId: import.meta.env.VITE_APPWRITE_DB_ID,
  appwriteTableId: import.meta.env.VITE_APPWRITE_TABLE_ID,
  appwriteReviewTableId: import.meta.env.VITE_APPWRITE_REVIEW_TABLE_ID,
  appwriteCoursesTableId: import.meta.env.VITE_APPWRITE_COURSES_TABLE_ID,
  appwriteBucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID,
  appwriteCourseBucketId: import.meta.env.VITE_APPWRITE_COURSE_BUCKET_ID,
  authToken: import.meta.env.VITE_AUTH_TOKEN,
  appwriteApiKey: import.meta.env.VITE_APPWRITE_API_TOKEN,
  adminEmails: String(import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  // Application settings
  app: {
    name: "Know Your Faculty",
    version: "1.0.0",
    description: "VIT-AP Faculty Directory",
  },
};

// Validate critical environment variables
const missingEnvVars = [];
if (!clientConfig.appwriteUrl) missingEnvVars.push("VITE_APPWRITE_URL");
if (!clientConfig.appwriteProjectId)
  missingEnvVars.push("VITE_APPWRITE_PROJECT_ID");

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Missing environment variables: ${missingEnvVars.join(", ")}. 
        The application may not function properly. 
        Please set these variables in your deployment environment or .env file.`,
  );
}

export default clientConfig;
