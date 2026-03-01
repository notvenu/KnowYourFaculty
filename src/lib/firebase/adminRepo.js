/**
 * Firebase Admin Repository
 * Server-side operations using Firebase Admin SDK
 * Bypasses security rules
 */

import admin from 'firebase-admin';
import serverConfig from '../../config/server.js';

// Initialize Admin SDK if not already done
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: serverConfig.firebaseProjectId,
    privateKey: serverConfig.firebasePrivateKey?.replace(/\\n/g, '\n'),
    clientEmail: serverConfig.firebaseClientEmail,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serverConfig.firebaseStorageBucket,
  });
}

const db = admin.firestore();
const storage = admin.storage();

const FACULTY_COLLECTION = serverConfig.firebaseFacultyCollection || 'faculty';

export async function addFacultyAdmin(facultyData) {
  try {
    const docRef = await db.collection(FACULTY_COLLECTION).add({
      ...facultyData,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return {
      $id: docRef.id,
      ...facultyData,
    };
  } catch (error) {
    throw error;
  }
}

export async function getAllEmployeeIdsAdmin() {
  try {
    const snapshot = await db
      .collection(FACULTY_COLLECTION)
      .select('employeeId')
      .get();

    return new Set(
      snapshot.docs
        .map((doc) => doc.data().employeeId)
        .filter((id) => id !== null && id !== undefined)
    );
  } catch (error) {
    return new Set();
  }
}

export async function getFacultyIndexByEmployeeIdAdmin() {
  try {
    const snapshot = await db
      .collection(FACULTY_COLLECTION)
      .select('employeeId', 'photoFileId')
      .get();

    const index = new Map();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.employeeId) {
        index.set(data.employeeId, {
          $id: doc.id,
          photoFileId: data.photoFileId,
        });
      }
    });
    return index;
  } catch (error) {
    return new Map();
  }
}

export async function updateFacultyPhotoByDocIdAdmin(docId, photoFileId) {
  try {
    await db.collection(FACULTY_COLLECTION).doc(docId).update({
      photoFileId: photoFileId,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
}

export async function uploadPhotoFromUrlAdmin(
  employeeId,
  photoUrl,
  options = {}
) {
  try {
    const response = await fetch(photoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch photo: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const filename = `${employeeId}.jpg`;
    const bucket = storage.bucket();
    const file = bucket.file(`faculty_photos/${filename}`);

    const metadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400',
    };

    await file.save(Buffer.from(buffer), { metadata });
    return filename;
  } catch (error) {
    throw error;
  }
}

export async function photoFileExistsAdmin(photoFileId) {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(`faculty_photos/${photoFileId}`);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    return false;
  }
}

export default {
  addFacultyAdmin,
  getAllEmployeeIdsAdmin,
  getFacultyIndexByEmployeeIdAdmin,
  updateFacultyPhotoByDocIdAdmin,
  uploadPhotoFromUrlAdmin,
  photoFileExistsAdmin,
};
