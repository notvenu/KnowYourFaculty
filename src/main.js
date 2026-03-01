import { weeklyScrape } from "./lib/scraper/weeklyScraper.js";

const REQUIRED_ENV_KEYS = [
  "KYF_PROJECT_ID",
  "KYF_CLIENT_EMAIL",
  "KYF_PRIVATE_KEY",
  "KYF_STORAGE_BUCKET",
  "AUTH_TOKEN",
  "KYF_FACULTY_COLLECTION",
];

function hasEnvValue(key) {
  const aliases = {
    KYF_PROJECT_ID: ["KYF_PROJECT_ID", "FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"],
    KYF_CLIENT_EMAIL: ["KYF_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL", "VITE_FIREBASE_CLIENT_EMAIL"],
    KYF_PRIVATE_KEY: ["KYF_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY", "VITE_FIREBASE_PRIVATE_KEY"],
    KYF_STORAGE_BUCKET: [
      "KYF_STORAGE_BUCKET",
      "FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_STORAGE_BUCKET",
    ],
    KYF_FACULTY_COLLECTION: [
      "KYF_FACULTY_COLLECTION",
      "FIREBASE_FACULTY_COLLECTION",
      "VITE_FIREBASE_FACULTY_COLLECTION",
    ],
    AUTH_TOKEN: ["AUTH_TOKEN", "VITE_AUTH_TOKEN"],
  };
  const keys = aliases[key] || [key];
  for (const envKey of keys) {
    if (String(process.env[envKey] || "").trim()) return true;
  }
  return false;
}

export async function runWeeklyScrape(logger = console) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !hasEnvValue(key));
  if (missing.length > 0) {
    const message = `Missing required env vars: ${missing.join(", ")}`;
    logger.error?.(message);
    throw new Error(message);
  }

  logger.log?.("Weekly scrape started");
  await weeklyScrape();
  logger.log?.("Weekly scrape completed");
  return { ok: true };
}

export { weeklyScrape };
