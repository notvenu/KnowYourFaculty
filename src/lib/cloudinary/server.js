import crypto from "node:crypto";
import serverConfig from "../../config/server.js";

export function createCloudinaryUploadSignature(params) {
  const apiSecret = String(serverConfig.cloudinaryApiSecret || "").trim();
  if (!apiSecret) {
    throw new Error("Missing CLOUDINARY_API_SECRET for signed uploads.");
  }

  const payload = Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}
