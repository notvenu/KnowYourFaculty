/**
 * 🖥️ SERVER CONFIGURATION
 * For Node.js backend services and scrapers
 * Uses process.env for Node.js environment variables
 */

import { config } from 'dotenv';
config();

const serverConfig = {
    appwriteUrl: process.env.VITE_APPWRITE_URL,
    appwriteProjectId: process.env.VITE_APPWRITE_PROJECT_ID,
    appwriteDBId: process.env.VITE_APPWRITE_DB_ID,
    appwriteTableId: process.env.VITE_APPWRITE_TABLE_ID,
    appwriteBucketId: process.env.VITE_APPWRITE_BUCKET_ID,
    authToken: process.env.VITE_AUTH_TOKEN,
    appwriteApiKey: process.env.VITE_APPWRITE_API_TOKEN,
    
    // Server-specific settings
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development'
    },
    
    // Scraper settings
    scraper: {
        apiUrl: 'https://vtopcc.vit.ac.in/vtop/content/listFacultyContent',
        batchSize: 50,
        retryAttempts: 3,
        timeout: 30000
    }
};

export default serverConfig;