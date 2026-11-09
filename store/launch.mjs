// Shared by the asset scripts: launches Chromium with the real extension loaded (headless, throwaway profile).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(import.meta.dirname, '..');
// Any Chromium-based browser that still allows --load-extension. Set BROWSER_PATH to use another one.
const BROWSER_PATH =
  process.env.BROWSER_PATH || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

export async function launch({ viewport, deviceScaleFactor = 1, recordVideo, colorScheme = 'light' } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'swift-translate-assets-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: BROWSER_PATH,
    headless: false, // '--headless=new' below: the old headless mode can't load extensions
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, '--headless=new'],
    viewport,
    deviceScaleFactor,
    colorScheme,
    ...(recordVideo ? { recordVideo } : {}),
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const close = async () => {
    await context.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { context, worker, extensionId, close };
}

/** Sets what the popup remembers: target language, source language and theme. */
export const configure = (worker, settings) =>
  worker.evaluate((s) => chrome.storage.sync.set(s), settings);
