import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright-core";

const ORIGIN = "http://localhost:4173";
const URL = `${ORIGIN}/`;
const OUT_DIR = path.resolve("Docs/Snapshots/latest");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer({ timeoutMs = 20_000 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ok = await new Promise((resolve) => {
      const req = http.get(URL, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ok) return;
    if (Date.now() - start > timeoutMs) throw new Error(`Server not ready after ${timeoutMs}ms: ${URL}`);
    await sleep(250);
  }
}

function startPreview() {
  const child = spawn("npm", ["run", "preview"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));

  return child;
}

async function snap({ name, viewport }) {
  const channel = process.env.PLAYWRIGHT_CHANNEL || "chrome";
  let browser;
  try {
    browser = await chromium.launch({ channel });
  } catch {
    // Fallback: try without a channel (works if a Playwright browser is installed).
    browser = await chromium.launch();
  }
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  // Let the lazy-loaded three.js chunk render at least one frame.
  await page.waitForTimeout(1600);

  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });

  await browser.close();
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const child = startPreview();
  try {
    await waitForServer();

    await snap({ name: "desktop", viewport: { width: 1440, height: 900 } });
    await snap({ name: "mobile", viewport: { width: 390, height: 844 } });
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
