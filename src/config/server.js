/**
 * 🖥️ SERVER CONFIGURATION
 * For Node.js backend services and scrapers
 * Uses process.env for Node.js environment variables
 */

import { config } from 'dotenv';
config();

const readServerEnv = (...keys) => {
    for (const key of keys) {
        const value = process.env[key];
        if (String(value || "").trim()) return value;
    }
    return undefined;
};

const serverConfig = {
    // Firebase Configuration
    firebaseProjectId: readServerEnv("FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
    firebasePrivateKey: readServerEnv("FIREBASE_PRIVATE_KEY", "VITE_FIREBASE_PRIVATE_KEY"),
    firebaseClientEmail: readServerEnv("FIREBASE_CLIENT_EMAIL", "VITE_FIREBASE_CLIENT_EMAIL"),
    firebaseStorageBucket: readServerEnv("FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),

    // Collection/Database names
    firebaseFacultyCollection: readServerEnv("FIREBASE_FACULTY_COLLECTION", "VITE_FIREBASE_FACULTY_COLLECTION") || "faculty",
    firebaseReviewCollection: readServerEnv("FIREBASE_REVIEW_COLLECTION", "VITE_FIREBASE_REVIEW_COLLECTION") || "reviews",
    firebaseCoursesCollection: readServerEnv("FIREBASE_COURSES_COLLECTION", "VITE_FIREBASE_COURSES_COLLECTION") || "courses",

    authToken: readServerEnv("AUTH_TOKEN", "VITE_AUTH_TOKEN"),
    
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
