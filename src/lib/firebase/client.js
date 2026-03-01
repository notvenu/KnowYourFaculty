import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import clientConfig from "../../config/client.js";

// Validate required configuration
if (!clientConfig.firebaseApiKey || !clientConfig.firebaseProjectId) {
  // Missing configuration - will error at runtime
}

const firebaseConfig = {
  apiKey: clientConfig.firebaseApiKey,
  authDomain: clientConfig.firebaseAuthDomain,
  projectId: clientConfig.firebaseProjectId,
  storageBucket: clientConfig.firebaseStorageBucket,
  messagingSenderId: clientConfig.firebaseMessagingSenderId,
  appId: clientConfig.firebaseAppId,
};

export const firebaseAppInstance = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseAppInstance);
export const db = getFirestore(firebaseAppInstance);
export const storage = getStorage(firebaseAppInstance);

// Enable offline persistence when supported.
enableIndexedDbPersistence(db).catch(() => {
  // Offline persistence errors are non-fatal
});

export default firebaseAppInstance;
