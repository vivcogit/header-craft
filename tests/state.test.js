import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseState, saveStateToFile, stringifyState } from '../client/files.js';
import {
  createDefaultState,
  importProfile,
  loadStoredState,
  removeTabId,
  serializeProfile,
} from '../client/state.js';
import { Store } from '../client/store.js';

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

function memoryStorage(initial = {}, beforeSet = async () => {}) {
  const data = structuredClone(initial);
  const calls = [];

  return {
    data,
    calls,
    async get(keys) {
      return Object.fromEntries(keys
        .filter((key) => data[key] !== undefined)
        .map((key) => [key, structuredClone(data[key])]));
    },
    async set(update) {
      const copy = structuredClone(update);
      calls.push(copy);
      await beforeSet(copy, calls.length);
      Object.assign(data, copy);
    },
  };
}

function workerRuntime(storage) {
  return {
    lastError: undefined,
    sendMessage({ activeGroup, state }, respond) {
      void storage.set({ group: activeGroup, state }).then(
        () => respond({ ok: true }),
        (error) => respond({ error: error.message }),
      );
    },
  };
}

test('fresh state has independent groups and rows', () => {
  const state = createDefaultState();

  assert.equal(state.length, 3);
  assert.ok(state.every((group) => group.items.length === 5));
  state[0].items[0].name = 'changed';
  state[0].items[0].tabIds.push('17');

  assert.equal(state[0].items[1].name, '');
  assert.deepEqual(state[0].items[1].tabIds, []);
  assert.equal(state[1].items[0].name, '');
  assert.deepEqual(loadStoredState(undefined), createDefaultState());
});

test('stored 0.9.11 state is cloned without losing tab activations', async () => {
  const raw = await fixture('0.9.11-storage.json');
  const snapshot = structuredClone(raw);
  const state = loadStoredState(raw);

  assert.deepEqual(state, raw);
  state[0].items[0].tabIds.pop();
  assert.deepEqual(raw, snapshot);
});

test('release profile imports disabled and serializes without tabIds', async () => {
  const exported = await fixture('0.9.11-export.json');
  const profileWithSessionIds = await fixture('0.9.11-storage.json');
  const imported = importProfile(exported);
  const loadedAfterReleaseImport = loadStoredState(exported);

  assert.ok(imported.flatMap((group) => group.items).every((item) => item.tabIds.length === 0));
  assert.ok(importProfile(profileWithSessionIds)
    .flatMap((group) => group.items)
    .every((item) => item.tabIds.length === 0));
  assert.deepEqual(serializeProfile(loadStoredState(profileWithSessionIds)), exported);
  assert.ok(loadedAfterReleaseImport.flatMap((group) => group.items).every((item) => item.tabIds.length === 0));
  assert.deepEqual(serializeProfile(imported), exported);
  assert.deepEqual(parseState(JSON.stringify(exported)), imported);

  const text = stringifyState(imported);
  assert.match(text, /\n  \{/);
  assert.equal(text.includes('tabIds'), false);
});

test('release profile import pipeline persists the normalized state', async () => {
  const current = await fixture('0.9.11-storage.json');
  const exported = await fixture('0.9.11-export.json');
  const storage = memoryStorage({ state: current, group: 1 });
  const store = await new Store('state', 'group', storage, workerRuntime(storage)).init();
  const imported = parseState(JSON.stringify(exported));

  await store.updateState(imported);

  assert.deepEqual(store.state, imported);
  assert.deepEqual(storage.data.state, imported);
  assert.equal(store.getGroupId(), 1);
  assert.ok(storage.data.state
    .flatMap((group) => group.items)
    .every((item) => item.tabIds.length === 0));
});

test('legacy object imports into group zero without activations', async () => {
  const legacy = await fixture('legacy-object.json');
  const snapshot = structuredClone(legacy);
  const state = importProfile(legacy);

  assert.equal(state.length, 3);
  assert.deepEqual(state[0].items[0], {
    tabIds: [],
    name: 'X-Legacy',
    value: 'one',
    comment: '',
  });
  assert.equal(state[1].items.length, 5);
  assert.deepEqual(legacy, snapshot);
});

test('malformed data throws without mutation or partial storage writes', async () => {
  const malformed = await fixture('malformed.json');
  const snapshot = structuredClone(malformed);

  assert.throws(() => loadStoredState(malformed), /items must be an array/);
  assert.throws(() => importProfile(malformed), /items must be an array/);
  assert.throws(() => parseState('{broken json'), SyntaxError);
  assert.deepEqual(malformed, snapshot);

  const current = createDefaultState();
  const storage = memoryStorage({ state: current, group: 0 });
  const store = await new Store('state', 'group', storage, workerRuntime(storage)).init();
  assert.throws(() => store.updateState(malformed), /items must be an array/);
  assert.equal(storage.calls.length, 0);
  assert.deepEqual(store.state, current);
});

test('removeTabId accepts a numeric Chrome tab ID and is immutable', async () => {
  const state = await fixture('0.9.11-storage.json');
  const snapshot = structuredClone(state);
  const cleaned = removeTabId(state, 29);

  assert.deepEqual(cleaned[0].items[0].tabIds, ['17']);
  assert.deepEqual(cleaned[1].items[0].tabIds, []);
  assert.deepEqual(state, snapshot);
});

test('Store persists defaults and commits memory only after successful writes', async () => {
  const emptyStorage = memoryStorage();
  const freshStore = await new Store(
    'state',
    'group',
    emptyStorage,
    workerRuntime(emptyStorage),
  ).init();
  assert.deepEqual(freshStore.state, createDefaultState());
  assert.deepEqual(emptyStorage.data.state, createDefaultState());

  const current = createDefaultState();
  const failingStorage = memoryStorage({ state: current, group: 0 }, async () => {
    throw new Error('storage unavailable');
  });
  const store = await new Store(
    'state',
    'group',
    failingStorage,
    workerRuntime(failingStorage),
  ).init();

  await assert.rejects(store.changeValue(0, 'name', 'lost'), /storage unavailable/);
  assert.equal(store.getState().items[0].name, '');
  assert.equal(failingStorage.data.state[0].items[0].name, '');
});

test('Store dispatches writes immediately and recovers after a worker error', async () => {
  const storage = memoryStorage({ state: createDefaultState(), group: 0 });
  const messages = [];
  const responders = [];
  const runtime = {
    lastError: undefined,
    sendMessage(message, respond) {
      messages.push(message);
      responders.push(respond);
    },
  };
  const store = await new Store('state', 'group', storage, runtime).init();
  const first = store.changeValue(0, 'name', 'X-Immediate');
  const second = store.changeValue(0, 'value', 'rejected');

  assert.equal(messages.length, 2);
  assert.equal(store.getState().items[0].name, '');
  assert.equal(messages[1].state[0].items[0].name, 'X-Immediate');
  assert.equal(messages[1].state[0].items[0].value, 'rejected');

  responders[0]({ ok: true });
  await first;
  responders[1]({ error: 'worker failed' });
  await assert.rejects(second, /worker failed/);

  const recovered = store.setActiveGroup(1);
  assert.equal(messages.length, 3);
  assert.equal(messages[2].activeGroup, 1);
  assert.equal(messages[2].state[0].items[0].name, 'X-Immediate');
  assert.equal(messages[2].state[0].items[0].value, '');
  responders[2]({ ok: true });
  await recovered;

  assert.equal(store.getGroupId(), 1);
  assert.equal(store.state[0].items[0].name, 'X-Immediate');
  assert.equal(store.state[0].items[0].value, '');
  assert.equal(store.getState().items[0].name, '');
});

test('download adapter uses .json, revokes its URL, and propagates errors', async () => {
  const originalChrome = globalThis.chrome;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  let options;

  URL.createObjectURL = () => 'blob:header-craft';
  URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.chrome = {
    downloads: {
      async download(nextOptions) {
        options = nextOptions;
        throw new Error('download failed');
      },
    },
  };

  try {
    await assert.rejects(saveStateToFile(createDefaultState()), /download failed/);
    assert.match(options.filename, /^header_craft_\d+\.json$/);
    assert.deepEqual(revoked, ['blob:header-craft']);
  } finally {
    globalThis.chrome = originalChrome;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
