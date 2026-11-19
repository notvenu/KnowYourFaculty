// One-off: derive the share image and icons from public/logo.png. Run: node scripts/makeSeoAssets.js
import sharp from "sharp";

const source = "public/logo.png"; // 1536x1024 wordmark on a grey ground
const png = { palette: true, quality: 80, compressionLevel: 9 };

// 1200x630 share card: scale to width, crop the vertical centre.
await sharp(source)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .png(png)
  .toFile("public/og-image.png");

// Square icons: crop around the magnifier mark only (x 575-915, y 215-555 in the source).
const mark = { left: 575, top: 215, width: 340, height: 340 };
for (const [file, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["favicon-48.png", 48],
]) {
  await sharp(source).extract(mark).resize(size, size).png(png).toFile(`public/${file}`);
}
console.log("SEO assets written to public/");
