import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import puppeteer from 'puppeteer';

async function closeBrowser(browser, userDataDir) {
  try {
    await browser?.close();
  } finally {
    await rm(userDataDir, { force: true, recursive: true });
  }
}

export async function launchExtension(extensionPath) {
  const userDataDir = await mkdtemp(join(tmpdir(), 'header-craft-'));
  const args = ['--disable-crash-reporter'];
  let browser;

  if (process.platform === 'linux' && process.env.CI === 'true') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  try {
    browser = await puppeteer.launch({
      args,
      dumpio: process.env.CI === 'true',
      enableExtensions: [extensionPath],
      headless: true,
      pipe: true,
      userDataDir,
    });
    const workerTarget = await browser.waitForTarget(
      (target) => target.type() === 'service_worker'
        && target.url().endsWith('/background.js'),
    );
    await workerTarget.worker();

    return {
      browser,
      close: () => closeBrowser(browser, userDataDir),
      extensionId: new URL(workerTarget.url()).host,
    };
  } catch (error) {
    await closeBrowser(browser, userDataDir).catch(() => undefined);
    throw error;
  }
}

export async function getExtensionWorker(browser, extensionId) {
  const workerTarget = await browser.waitForTarget(
    (target) => target.type() === 'service_worker'
      && new URL(target.url()).host === extensionId,
  );

  return workerTarget.worker();
}

export async function openActionPopup(browser, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const existingTargets = new Set(browser.targets());
  const worker = await getExtensionWorker(browser, extensionId);

  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.windowId) {
      throw new Error('Chrome did not create an active browser tab');
    }

    await chrome.action.openPopup({ windowId: tab.windowId });
  });

  const popupTarget = await browser.waitForTarget(
    (target) => !existingTargets.has(target) && target.url() === popupUrl,
  );
  const popup = await popupTarget.asPage();

  if (!popup) {
    throw new Error('Chrome action popup did not create a page');
  }

  await popup.waitForSelector('#headersTable input[name="enabled"]');
  return popup;
}
