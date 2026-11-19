// Tells Bing, Yandex and other IndexNow engines (ChatGPT search reads Bing's index) which URLs changed.
// Run after a production deploy: npm run seo:indexnow   (reads dist/sitemap.xml from the last build)
import { readFile } from "node:fs/promises";
import process from "node:process";

// Auto mode (end of `npm run build`): only ping on Vercel production deploys, never on local/preview builds.
// Manual `npm run seo:indexnow` passes --force.
if (!process.argv.includes("--force") && process.env.VERCEL_ENV !== "production") {
  console.log("IndexNow: skipped (not a production deploy)");
  process.exit(0);
}

const KEY = "c278323ee326ca21cb262a23f434b316"; // public by design: public/c278323ee326ca21cb262a23f434b316.txt proves we own the host
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error("No URLs in dist/sitemap.xml. Run npm run build first.");

const host = new URL(urlList[0]).host;
try {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList: urlList.slice(0, 10000) }),
  });
  console.log(`IndexNow: submitted ${urlList.length} URLs for ${host}, HTTP ${res.status}`);
} catch (err) {
  // never fail a deploy over a ping
  console.warn("IndexNow failed:", err.message);
}
