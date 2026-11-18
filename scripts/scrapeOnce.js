import { config } from "dotenv";
import { weeklyScrape } from "../src/lib/scraper/weeklyScraper.js";

config();

const dryRun = process.argv.includes("--dry-run");
const startedAt = Date.now();

try {
  console.log(`Starting one-time faculty scrape${dryRun ? " (dry run, no writes)" : ""}...`);
  const result = await weeklyScrape({ dryRun });

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("Scrape summary:", result);
  console.log(`Faculty scrape completed in ${durationSeconds}s.`);

  if (result && result.ok === false) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Faculty scrape failed:");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
}
