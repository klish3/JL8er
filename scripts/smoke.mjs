import { chromium } from "playwright";

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
const failed = [];
page.on("requestfailed", (r) => failed.push(r.url() + " " + (r.failure()?.errorText || "")));

await page.goto("http://localhost:8123/#/c/1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const title = await page.textContent("#comic-title");
const counter = await page.textContent("#counter-cur");
const total = await page.textContent("#counter-total");
await page.waitForSelector(".strip img", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
const imgs = await page.$$eval(".strip img", (els) =>
  els.map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth, loaded: i.classList.contains("loaded") }))
);
console.log("comic1 title:", title, "counter:", counter + "/" + total);
console.log("comic1 imgs:", JSON.stringify(imgs));
console.log("comic1 strip html:", (await page.innerHTML("#strip")).slice(0, 300));

await page.screenshot({ path: "scripts/shot-reader.png", fullPage: false });

// next via keyboard
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(800);
console.log("after ArrowRight counter:", await page.textContent("#counter-cur"));

// multi-panel comic
await page.goto("http://localhost:8123/#/c/200", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const n200 = await page.$$eval(".strip img", (e) => e.length);
console.log("comic 200 panel count:", n200);

// chaptered 270
await page.goto("http://localhost:8123/#/c/270", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const n270 = await page.$$eval(".strip img", (e) => e.length);
const dividers = await page.$$eval(".chapter-divider", (e) => e.length);
console.log("comic 270 panels:", n270, "dividers:", dividers);

// archive
await page.goto("http://localhost:8123/#/archive", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const cards = await page.$$eval(".card", (e) => e.length);
console.log("archive cards:", cards);
await page.screenshot({ path: "scripts/shot-archive.png", fullPage: false });

// light theme screenshot
await page.goto("http://localhost:8123/#/c/1", { waitUntil: "networkidle" });
await page.click("#btn-theme");
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/shot-light.png", fullPage: false });

console.log("ERRORS:", errors.length ? errors : "none");
console.log("FAILED REQ:", failed.length ? failed.slice(0, 8) : "none");

await browser.close();
