/**
 * 🌐 CLIENT CONFIGURATION
 * For React/Vite frontend components AND server-side usage
 * Uses import.meta.env for Vite, falls back to process.env for Node.js
 */

// Handle both Vite (browser) and Node.js (server) environments
const getEnv = (key) => {
  // Browser/Vite
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  // Node.js
  return process.env[key];
};

const clientConfig = {
  // Firebase Configuration
  firebaseApiKey: getEnv('VITE_FIREBASE_API_KEY'),
  firebaseAuthDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  firebaseProjectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  firebaseStorageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  firebaseMessagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  firebaseAppId: getEnv('VITE_FIREBASE_APP_ID'),

  // Collection/Database names
  firebaseFacultyCollection: getEnv('VITE_FIREBASE_FACULTY_COLLECTION') || "faculty",
  firebaseReviewCollection: getEnv('VITE_FIREBASE_REVIEW_COLLECTION') || "reviews",
  firebaseCoursesCollection: getEnv('VITE_FIREBASE_COURSES_COLLECTION') || "courses",
  firebasePollCollection: getEnv('VITE_FIREBASE_POLL_COLLECTION') || "polls",
  firebasePollVotesCollection: getEnv('VITE_FIREBASE_POLL_VOTES_COLLECTION') || "poll_votes",

  adminEmails: String(getEnv('VITE_ADMIN_EMAILS') || "")
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
if (!clientConfig.firebaseApiKey) missingEnvVars.push("VITE_FIREBASE_API_KEY");
if (!clientConfig.firebaseProjectId)
  missingEnvVars.push("VITE_FIREBASE_PROJECT_ID");

if (missingEnvVars.length > 0) {
}

export default clientConfig;
