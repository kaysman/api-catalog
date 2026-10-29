/**
 * Captures the README screenshots and demo GIF from a running example app.
 *
 *   (cd examples/nestjs && npm start)      # or: cargo run -p api-catalog-example-axum
 *   node scripts/capture.mjs [http://localhost:3000/docs]
 *
 * Writes docs/assets/{console.png,create-user.png,demo.gif}. The GIF needs
 * ffmpeg on PATH; without it the raw .webm recording is kept instead.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out  = join(root, "docs/assets");
const url  = process.argv[2] ?? "http://localhost:3000/docs";
const viewport = { width: 1280, height: 720 };

mkdirSync(out, { recursive: true });

const pane = (key) => `.pane[data-key="${key}"]`;
const newUser = JSON.stringify({ name: "Dana Lee", email: "dana@example.com", role: "admin" }, null, 2);

async function open(page, key) {
  await page.click(`.ep[data-key="${key}"]`);
  await page.waitForSelector(pane(key));
}

async function send(page, key) {
  await page.click(`${pane(key)} .pg-send`);
  await page.waitForSelector(`${pane(key)} .resp-body:not([style*="none"])`);
  await page.waitForTimeout(300);
}

// ── Screenshots ─────────────────────────────────────────────────────────────

const browser = await chromium.launch();
{
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.waitForSelector(".ep");

  const getUser = "get:/users/{id}";
  await open(page, getUser);
  await page.fill(`${pane(getUser)} .kv-params .v`, "2");
  await send(page, getUser);
  await page.screenshot({ path: join(out, "console.png") });

  const createUser = "post:/users";
  await open(page, createUser);
  await page.click(`${pane(createUser)} .req-tab[data-rt="body"]`);
  await page.fill(`${pane(createUser)} .pg-body`, newUser);
  await send(page, createUser);
  await page.screenshot({ path: join(out, "create-user.png") });
  await page.close();
}

// ── Demo recording ──────────────────────────────────────────────────────────

const videoDir = mkdtempSync(join(tmpdir(), "api-catalog-video-"));
{
  const context = await browser.newContext({ viewport, recordVideo: { dir: videoDir, size: viewport } });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector(".ep");
  await page.waitForTimeout(900);

  const getUser = "get:/users/{id}";
  await open(page, getUser);
  await page.waitForTimeout(600);
  const id = page.locator(`${pane(getUser)} .kv-params .v`).first();
  await id.fill("");
  await id.pressSequentially("1", { delay: 150 });
  await page.waitForTimeout(400);
  await send(page, getUser);
  await page.waitForTimeout(1500);

  const createUser = "post:/users";
  await open(page, createUser);
  await page.waitForTimeout(500);
  await page.click(`${pane(createUser)} .req-tab[data-rt="body"]`);
  await page.waitForTimeout(500);
  await page.fill(`${pane(createUser)} .pg-body`, newUser);
  await page.waitForTimeout(700);
  await send(page, createUser);
  await page.waitForTimeout(1500);

  await page.click(`${pane(createUser)} .req-tab[data-rt="docs"]`);
  await page.waitForTimeout(1800);
  await context.close();
}
await browser.close();

const webm = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith(".webm")));
try {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", webm,
    "-vf", "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    join(out, "demo.gif"),
  ]);
  console.log("wrote docs/assets/console.png, create-user.png, demo.gif");
} catch {
  renameSync(webm, join(out, "demo.webm"));
  console.log("ffmpeg not found — kept docs/assets/demo.webm instead of a GIF");
}
rmSync(videoDir, { recursive: true, force: true });
