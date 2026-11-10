import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projects = [
  { id: "royal-treats", name: "Royal Treats", url: "https://royal-treats.netlify.app/" },
];
const folder = "public/images/projects";
await mkdir(folder, { recursive: true });
await mkdir(path.join(folder, "mobile"), { recursive: true });
const manifest = { capturedAt: new Date().toISOString(), method: "Playwright Chromium", projects: [] };
const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
const errors = [];

async function capture(project, mobile) {
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    colorScheme: "light", locale: "en-ZA", timezoneId: "Africa/Johannesburg"
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(project.url, { waitUntil: "domcontentloaded", timeout: 75000 });
    if (!response || response.status() >= 400) throw Error("HTTP status " + (response?.status() || "unknown"));
    await page.waitForTimeout(12000);
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    const metadata = await page.evaluate(() => ({
      title: document.title,
      bodyText: document.body.innerText.slice(0, 10000),
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight
    }));
    if (metadata.bodyText.trim().length < 75)
      throw Error("Only " + metadata.bodyText.trim().length + " visible text characters; possibly a blank app shell.");
    if (/^(404|not found|page not found|site not found)\s*$/i.test(metadata.title.trim()))
      throw Error("Error page: " + metadata.title);
    const shot = await page.screenshot({ type: "png", animations: "disabled", timeout: 30000 });
    const width = mobile ? 390 : 1200;
    const height = mobile ? 844 : 750;
    const file = path.join(folder, mobile ? "mobile" : "", project.id + "-live.webp");
    await sharp(shot).resize(width, height, { fit: "cover", position: "top" }).webp({ quality: 82, effort: 5 }).toFile(file);
    const image = sharp(file);
    const stats = await image.stats();
    const entropy = Math.max(...stats.channels.map(x => x.entropy));
    if (entropy < 0.8) throw Error("Image appears nearly blank (entropy " + entropy.toFixed(2) + ").");
    const { size: bytes } = await import("node:fs/promises").then(fs => fs.stat(file));
    if (bytes < 9000) throw Error("Screenshot unexpectedly small (" + bytes + " bytes).");
    console.log(JSON.stringify({ project: project.name, type: mobile ? "mobile" : "desktop", title: metadata.title,
      bodyTextLength: metadata.bodyText.length, entropy, bytes, path: file, status: response.status() }));
    return { path: file, title: metadata.title, bytes, entropy: Number(entropy.toFixed(2)),
      bodyTextLength: metadata.bodyText.length, status: response.status(), viewport };
  } finally {
    await context.close();
  }
}

for (const project of projects) {
  const result = { ...project };
  try { result.desktop = await capture(project, false); }
  catch (error) { errors.push(project.name + " desktop: " + error.message); console.error(errors.at(-1)); }
  try { result.mobile = await capture(project, true); }
  catch (error) { errors.push(project.name + " mobile: " + error.message); console.error(errors.at(-1)); }
  manifest.projects.push(result);
}
await browser.close();
await writeFile(path.join(folder, "royal-treats-capture.json"), JSON.stringify(manifest, null, 2) + "\n");
if (errors.length) {
  console.error("Some captures failed:\n" + errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Royal Treats desktop and mobile screenshots captured and verified.");
}
