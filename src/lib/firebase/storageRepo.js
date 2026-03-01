import { storage } from "./client.js";
import axios from "axios";
import serverConfig from "../../config/server.js";
import {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  getMetadata,
} from "firebase/storage";

function resolvePhotoUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return new URL(url, "https://cms.vitap.ac.in").toString();
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("image/avif")) return "avif";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/jpeg")) return "jpg";
  return "jpg";
}

async function maybeConvertAvifToJpeg(fileBuffer, contentType) {
  if (!String(contentType).toLowerCase().includes("image/avif")) {
    return { buffer: fileBuffer, contentType };
  }

  try {
    const { default: sharp } = await import("sharp");
    const converted = await sharp(fileBuffer)
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer: converted, contentType: "image/jpeg" };
  } catch {
    // If sharp is not installed, keep original AVIF.
    return { buffer: fileBuffer, contentType };
  }
}

const PHOTOS_PATH = "faculty_photos";

async function uploadPhotoBuffer(employeeId, fileBuffer, contentType, options = {}) {
  const { forceReplace = false } = options;

  try {
    const photoRef = ref(
      storage,
      `${PHOTOS_PATH}/${employeeId}`
    );

    // Check if file already exists
    try {
      await getMetadata(photoRef);
      if (!forceReplace) {
        return employeeId;
      }

      // Delete existing file
      await deleteObject(photoRef);
    } catch {
      // File doesn't exist, continue with upload
    }

    try {
      if (!String(contentType || "").toLowerCase().startsWith("image/")) {
        throw new Error(`Non-image content type: ${contentType}`);
      }
      if (!fileBuffer?.length) {
        throw new Error("Image buffer is empty");
      }

      const converted = await maybeConvertAvifToJpeg(fileBuffer, contentType);
      const extension = extensionFromContentType(converted.contentType);

      // Upload to Firebase Storage
      const uploadRef = ref(
        storage,
        `${PHOTOS_PATH}/${employeeId}.${extension}`
      );

      const file = new File([converted.buffer], `${employeeId}.${extension}`, {
        type: converted.contentType,
      });

      const uploadTask = await uploadBytes(uploadRef, file);
      return uploadTask.metadata.name || employeeId;
    } catch (error) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

export async function uploadPhotoFromBuffer(
  employeeId,
  fileBuffer,
  contentType,
  options = {}
) {
  return uploadPhotoBuffer(employeeId, fileBuffer, contentType, options);
}

export async function photoFileExists(fileId) {
  if (!fileId) return false;
  try {
    const photoRef = ref(storage, `${PHOTOS_PATH}/${fileId}`);
    await getMetadata(photoRef);
    return true;
  } catch {
    return false;
  }
}

export async function uploadPhotoFromUrl(employeeId, url, options = {}) {
  try {
    const sourceUrl = resolvePhotoUrl(url);
    if (!sourceUrl) return null;
    const response = await axios.get(sourceUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*",
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const incomingContentType = response.headers["content-type"] || "image/jpeg";
    const originalBuffer = Buffer.from(response.data);
    return uploadPhotoBuffer(employeeId, originalBuffer, incomingContentType, options);
  } catch (error) {
    return null;
  }
}

export async function getPhotoUrl(photoFileId) {
  if (!photoFileId) return null;

  try {
    // Firebase Storage doesn't have a simple URL retrieval like Appwrite
    // You need to generate a signed URL or use the public URL if bucket is public
    const photoRef = ref(storage, `${PHOTOS_PATH}/${photoFileId}`);

    // Check if file exists
    await getMetadata(photoRef);

    // Return Firebase Storage URL (works if bucket is public)
    // Storage URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
    return `https://firebasestorage.googleapis.com/v0/b/${serverConfig.firebaseStorageBucket}/o/${encodeURIComponent(`${PHOTOS_PATH}/${photoFileId}`)}?alt=media`;
  } catch (error) {
    return null;
  }
}

export default {
  uploadPhotoFromBuffer,
  uploadPhotoFromUrl,
  photoFileExists,
  getPhotoUrl,
};
