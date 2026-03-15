import axios from "axios";
import serverConfig from "../../config/server.js";
import {
  buildCloudinaryPublicId,
  getCloudinaryImageUrl,
} from "../cloudinary/shared.js";
import { createCloudinaryUploadSignature } from "../cloudinary/server.js";

function resolvePhotoUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return new URL(url, "https://cms.vitap.ac.in").toString();
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  return "jpg";
}

async function convertImageToJpeg(fileBuffer) {
  try {
    const { default: sharp } = await import("sharp");
    const converted = await sharp(fileBuffer).jpeg({ quality: 85 }).toBuffer();
    return converted;
  } catch {
    return fileBuffer;
  }
}

async function uploadBufferToCloudinary(
  employeeId,
  fileBuffer,
  contentType,
  options = {},
) {
  const cloudName = String(serverConfig.cloudinaryCloudName || "").trim();
  const apiKey = String(serverConfig.cloudinaryApiKey || "").trim();
  const uploadPreset = String(serverConfig.cloudinaryUploadPreset || "").trim();
  if (!cloudName) {
    throw new Error("Missing CLOUDINARY_CLOUD_NAME.");
  }

  const convertedBuffer = await convertImageToJpeg(fileBuffer);
  const extension = extensionFromContentType("image/jpeg");
  const publicId = buildCloudinaryPublicId(`${employeeId}.${extension}`);
  const timestamp = Math.floor(Date.now() / 1000);
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([convertedBuffer], { type: "image/jpeg" }),
    `${employeeId}.${extension}`,
  );
  formData.append("public_id", publicId);
  formData.append("format", "jpg");
  formData.append("overwrite", options.forceReplace ? "true" : "false");
  formData.append("timestamp", String(timestamp));

  if (uploadPreset) {
    formData.append("upload_preset", uploadPreset);
  }

  if (apiKey) {
    const signature = createCloudinaryUploadSignature({
      format: "jpg",
      overwrite: options.forceReplace ? "true" : "false",
      public_id: publicId,
      timestamp,
      ...(uploadPreset ? { upload_preset: uploadPreset } : {}),
    });
    formData.append("api_key", apiKey);
    formData.append("signature", signature);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const payload = await response.json();
  return payload.public_id || publicId;
}

export async function uploadPhotoFromBuffer(
  employeeId,
  fileBuffer,
  contentType,
  options = {},
) {
  return uploadBufferToCloudinary(employeeId, fileBuffer, contentType, options);
}

export async function photoFileExists(fileId) {
  const url = getCloudinaryImageUrl(fileId);
  if (!url) return false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadPhotoFromUrl(employeeId, url, options = {}) {
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
  return uploadBufferToCloudinary(
    employeeId,
    originalBuffer,
    incomingContentType,
    options,
  );
}

export async function getPhotoUrl(photoFileId) {
  return getCloudinaryImageUrl(photoFileId);
}

export default {
  uploadPhotoFromBuffer,
  uploadPhotoFromUrl,
  photoFileExists,
  getPhotoUrl,
};
