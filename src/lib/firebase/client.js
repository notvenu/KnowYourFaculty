import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
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

// Use persistent local cache (IndexedDB) to dramatically reduce Firestore reads.
// persistentMultipleTabManager allows the cache to work across multiple browser tabs.
export const db = initializeFirestore(firebaseAppInstance, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(firebaseAppInstance);

export default firebaseAppInstance;
