import { weeklyScrape } from "./lib/scraper/weeklyScraper.js";

const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "AUTH_TOKEN",
  "SUPABASE_FACULTY_TABLE",
];

function hasEnvValue(key) {
  const aliases = {
    SUPABASE_URL: ["SUPABASE_URL", "VITE_SUPABASE_URL"],
    SUPABASE_SERVICE_ROLE_KEY: ["SUPABASE_SERVICE_ROLE_KEY"],
    CLOUDINARY_CLOUD_NAME: [
      "CLOUDINARY_CLOUD_NAME",
      "VITE_CLOUDINARY_CLOUD_NAME",
    ],
    SUPABASE_FACULTY_TABLE: [
      "SUPABASE_FACULTY_TABLE",
      "VITE_SUPABASE_FACULTY_TABLE",
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
