import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineSecret } from "firebase-functions/params";

const authToken = defineSecret("AUTH_TOKEN");

setGlobalOptions({
  region: "asia-south1",
  timeoutSeconds: 540,
  memory: "1GiB",
});

export const weeklyFacultyScraper = onSchedule(
  {
    schedule: "0 3 * * 1",
    timeZone: "Asia/Kolkata",
    retryCount: 1,
    secrets: [authToken],
  },
  async () => {
    logger.info("weeklyFacultyScraper triggered");
    const { runWeeklyScrape } = await import("./src/main.js");
    const result = await runWeeklyScrape({
      log: (message) => logger.info(message),
      error: (message) => logger.error(message),
    });
    logger.info("weeklyFacultyScraper completed", result);
  },
);
