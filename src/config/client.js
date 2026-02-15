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
        name: 'Know Your Faculty',
        version: '1.0.0',
        description: 'VIT-AP Faculty Directory'
    }
};

export default clientConfig;
