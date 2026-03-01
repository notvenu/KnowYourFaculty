import admin from 'firebase-admin';
import serverConfig from '../../config/server.js';

// Check if already initialized
if (!admin.apps.length) {
  // Service account credentials from environment variables
  const serviceAccount = {
    projectId: serverConfig.firebaseProjectId,
    privateKey: serverConfig.firebasePrivateKey?.replace(/\\n/g, '\n'),
    clientEmail: serverConfig.firebaseClientEmail,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serverConfig.firebaseStorageBucket,
  });

  // Firebase Admin SDK initialized
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();

export default admin;
