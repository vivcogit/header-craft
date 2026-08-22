import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { startEchoServer } from './helpers/echo-server.js';
import {
  getExtensionWorker,
  launchExtension,
  openActionPopup,
} from './helpers/extension.js';

const extensionPath = process.env.HEADER_CRAFT_EXTENSION_PATH
  ? resolve(process.env.HEADER_CRAFT_EXTENSION_PATH)
  : fileURLToPath(new URL('..', import.meta.url));

test('applies a header to one tab across origins and cleans up when it closes', { timeout: 30_000 }, async (t) => {
  const server = await startEchoServer();
  t.after(server.close);

  const { browser, close, extensionId } = await launchExtension(extensionPath);
  t.after(close);

  const selectedTab = await browser.newPage();
  await selectedTab.goto(server.url('localhost', '/selected-before'));
  await selectedTab.bringToFront();

  const popup = await openActionPopup(browser, extensionId);
  const selectedTabId = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.id;
  });
  const headerName = 'X-Header-Craft-E2E';
  const headerValue = 'selected-tab';
  const firstRow = '#headersTableBody tr[data-id="0"]';

  await popup.$eval(`${firstRow} input.name`, (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, headerName);
  await popup.$eval(`${firstRow} input.value`, (input, value) => {
    for (let index = 0; index < 20; index += 1) {
      input.value = index === 19 ? value : `queued-${index}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, headerValue);
  await popup.click(`${firstRow} input[name="enabled"]`);
  await popup.click('label[for="groupRadio1"]');
  await popup.close();

  const currentWorker = await getExtensionWorker(browser, extensionId);
  await currentWorker.evaluate(({ name, tabId, value }) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;
    let lastSeen;

    async function check() {
      const { group, state } = await chrome.storage.sync.get(['group', 'state']);
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const item = state?.[0]?.items?.[0];
      const saved = group === 1
        && item?.name === name
        && item.value === value
        && item.tabIds.includes(String(tabId));
      const ruled = rules.some((rule) => rule.condition.tabIds?.includes(tabId));
      lastSeen = { group, item, rules };

      if (saved && ruled) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error(`Popup changes were not saved after it closed: ${JSON.stringify(lastSeen)}`));
      } else {
        setTimeout(check, 25);
      }
    }

    void check();
  }), { name: headerName, tabId: selectedTabId, value: headerValue });

  const selectedResponse = await selectedTab.goto(server.url('localhost', '/selected-after'));
  const selectedHeaders = await selectedResponse.json();
  assert.equal(selectedHeaders[headerName.toLowerCase()], headerValue);

  const crossOriginHeaders = await selectedTab.evaluate(async (url) => {
    const response = await fetch(url);
    return response.json();
  }, server.url('127.0.0.1', '/cross-origin'));
  assert.equal(crossOriginHeaders[headerName.toLowerCase()], headerValue);

  const otherTab = await browser.newPage();
  const otherResponse = await otherTab.goto(server.url('localhost', '/other-tab'));
  const otherHeaders = await otherResponse.json();
  assert.equal(otherHeaders[headerName.toLowerCase()], undefined);

  await currentWorker.evaluate(async () => {
    const { state } = await chrome.storage.sync.get('state');
    state[0].items[0].value = 'invalid\r\nvalue';
    await chrome.storage.sync.set({ state });
  });
  await currentWorker.evaluate(() => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;

    async function check() {
      const rules = await chrome.declarativeNetRequest.getSessionRules();

      if (rules.length === 0) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error('Invalid state left a stale DNR rule active'));
      } else {
        setTimeout(check, 25);
      }
    }

    void check();
  }));

  const invalidResponse = await selectedTab.goto(server.url('localhost', '/invalid-rule'));
  const invalidHeaders = await invalidResponse.json();
  assert.equal(invalidHeaders[headerName.toLowerCase()], undefined);

  await currentWorker.evaluate(async (value) => {
    const { state } = await chrome.storage.sync.get('state');
    state[0].items[0].value = value;
    await chrome.storage.sync.set({ state });
  }, headerValue);
  await currentWorker.evaluate((tabId) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;

    async function check() {
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const restored = rules.some((rule) => rule.condition.tabIds?.includes(tabId));

      if (restored) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error('Valid DNR rules did not recover after a rejected update'));
      } else {
        setTimeout(check, 25);
      }
    }

    void check();
  }), selectedTabId);

  const restoredResponse = await selectedTab.goto(server.url('localhost', '/restored-rule'));
  const restoredHeaders = await restoredResponse.json();
  assert.equal(restoredHeaders[headerName.toLowerCase()], headerValue);

  await otherTab.bringToFront();
  const stalePopup = await openActionPopup(browser, extensionId);
  const cleanupPromise = currentWorker.evaluate(({ name, tabId, value }) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;

    async function check() {
      const { state } = await chrome.storage.sync.get('state');
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const item = state?.[0]?.items?.[0];
      const profilePreserved = item?.name === name && item.value === value;
      const stored = state?.some((group) => group.items.some((item) =>
        item.tabIds.includes(String(tabId))));
      const ruled = rules.some((rule) => rule.condition.tabIds?.includes(tabId));

      if (profilePreserved && !stored && !ruled) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error('Closed tab was not removed from storage and DNR rules'));
      } else {
        setTimeout(check, 25);
      }
    }

    void check();
  }), { name: headerName, tabId: selectedTabId, value: headerValue });

  await selectedTab.close();
  await cleanupPromise;

  await stalePopup.$eval(`${firstRow} input.comment`, (input) => {
    input.value = 'saved after another tab closed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await stalePopup.close();

  const finalWorker = await getExtensionWorker(browser, extensionId);
  await finalWorker.evaluate(({ name, tabId, value }) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;

    async function check() {
      const { state } = await chrome.storage.sync.get('state');
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const profilePreserved = state?.[0]?.items?.[0]?.name === name
        && state[0].items[0].value === value;
      const lateEditSaved = state?.[1]?.items?.[0]?.comment === 'saved after another tab closed';
      const stored = state?.some((group) => group.items.some((item) =>
        item.tabIds.includes(String(tabId))));
      const ruled = rules.some((rule) => rule.condition.tabIds?.includes(tabId));

      if (profilePreserved && lateEditSaved && !stored && !ruled) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error('A stale popup reintroduced a closed tab ID'));
      } else {
        setTimeout(check, 25);
      }
    }

    void check();
  }), { name: headerName, tabId: selectedTabId, value: headerValue });
});
