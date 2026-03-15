import clientConfig from "../../config/client.js";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function extractExtension(value) {
  const normalized = trimLeadingSlash(String(value || "").trim());
  const lastSegment = normalized.split("/").pop() || "";
  const match = lastSegment.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function getCloudinaryFolder() {
  return trimTrailingSlash(clientConfig.cloudinaryFolder || "faculty_photos");
}

export function getCloudinaryCloudName() {
  return String(clientConfig.cloudinaryCloudName || "").trim();
}

export function buildCloudinaryPublicId(fileId) {
  const normalized = trimLeadingSlash(String(fileId || "").trim());
  if (!normalized) return "";
  if (normalized.includes("/")) return normalized;

  const folder = getCloudinaryFolder();
  return folder ? `${folder}/${normalized}` : normalized;
}

export function getCloudinaryImageUrl(fileId) {
  const cloudName = getCloudinaryCloudName();
  const publicId = buildCloudinaryPublicId(fileId);
  if (!cloudName || !publicId) return null;
  const extension = extractExtension(publicId);
  const formatSuffix = extension ? `.${extension}` : "";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${encodeURI(publicId)}${formatSuffix}`;
}

export function isCloudinaryUrl(value) {
  return /res\.cloudinary\.com/i.test(String(value || ""));
}
