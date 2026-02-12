import { storage } from "./client.js";
import axios from "axios";
import serverConfig from "../../config/server.js";

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
    const converted = await sharp(fileBuffer).jpeg({ quality: 85 }).toBuffer();
    return { buffer: converted, contentType: "image/jpeg" };
  } catch {
    // If sharp is not installed, keep original AVIF.
    return { buffer: fileBuffer, contentType };
  }
}

async function uploadPhotoBuffer(employeeId, fileBuffer, contentType, options = {}) {
  const { forceReplace = false } = options;

  try {
    const existing = await storage.getFile(serverConfig.appwriteBucketId, employeeId);
    if (existing?.sizeOriginal > 0) {
      if (!forceReplace) {
        console.log(`Photo already exists for employee ${employeeId}`);
        return employeeId;
      }

      await storage.deleteFile(serverConfig.appwriteBucketId, employeeId);
      console.log(`Replacing existing photo for employee ${employeeId}`);
    }
  } catch {
    // Continue upload flow when file does not exist.
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
    const filename = `${employeeId}.${extension}`;
    const file = new File([converted.buffer], filename, { type: converted.contentType });

    const uploadedFile = await storage.createFile(
      serverConfig.appwriteBucketId,
      employeeId,
      file
    );

    console.log(`Photo uploaded for employee ${employeeId}`);
    return uploadedFile.$id;
  } catch (error) {
    console.error(`Photo upload failed for ${employeeId}:`, error.message);
    return null;
  }
}

export async function uploadPhotoFromBuffer(employeeId, fileBuffer, contentType, options = {}) {
  return uploadPhotoBuffer(employeeId, fileBuffer, contentType, options);
}

export async function photoFileExists(fileId) {
  if (!fileId) return false;
  try {
    const file = await storage.getFile(serverConfig.appwriteBucketId, fileId);
    return Boolean(file?.$id);
  } catch {
    return false;
  }
}

export async function uploadPhotoFromUrl(employeeId, url, options = {}) {
  try {
    const sourceUrl = resolvePhotoUrl(url);
    if (!sourceUrl) return null;

    console.log(`Downloading photo from: ${sourceUrl}`);
    const response = await axios.get(sourceUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*"
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    const incomingContentType = response.headers["content-type"] || "image/jpeg";
    const originalBuffer = Buffer.from(response.data);
    return uploadPhotoBuffer(employeeId, originalBuffer, incomingContentType, options);
  } catch (error) {
    console.error(`Photo upload failed for ${employeeId}:`, error.message);
    return null;
  }
}
