import { weeklyScrape } from "./lib/scraper/weeklyScraper.js";

const REQUIRED_ENV_KEYS = [
  "VITE_APPWRITE_URL",
  "VITE_APPWRITE_PROJECT_ID",
  "VITE_APPWRITE_DB_ID",
  "VITE_APPWRITE_TABLE_ID",
  "VITE_APPWRITE_BUCKET_ID",
  "VITE_AUTH_TOKEN",
  "VITE_APPWRITE_API_TOKEN"
];

export default async (context) => {
  const { res, log, error } = context;
  try {
    const missing = REQUIRED_ENV_KEYS.filter((key) => !String(process.env[key] || "").trim());
    if (missing.length > 0) {
      error(`Missing required function env vars: ${missing.join(", ")}`);
      return res.json({ ok: false, message: "Missing function env vars", missing }, 500);
    }

    log("Weekly scrape function started");
    await weeklyScrape();
    log("Weekly scrape function completed");
    return res.json({ ok: true, message: "Weekly scrape completed" });
  } catch (err) {
    const message = err?.message || String(err);
    error(`Weekly scrape function failed: ${message}`);
    return res.json({ ok: false, message }, 500);
  }
};
