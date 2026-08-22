import {
  createDefaultState,
  loadStoredState,
  removeTabId,
} from './client/state.js';

const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';
const STATE_KEY = 'state';
const GROUP_KEY = 'group';
const SAVE_STATE_MESSAGE = 'save-state';
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const ALL_RESOURCE_TYPES = Object.values(
  chrome.declarativeNetRequest.ResourceType,
);

let currentTabId = null;
let state = [];
let stateChangeVersion = 0;
let activeTabChangeVersion = 0;
let reconcileChain = Promise.resolve();
let pendingStateWrites = [];
let stateWriterPromise = Promise.resolve();
let stateWriterRunning = false;
let tabCleanupChain = Promise.resolve();

chrome.storage.onChanged.addListener(handleStorageChange);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.tabs.onActivated.addListener(handleActiveTabChanged);
chrome.tabs.onRemoved.addListener(handleCloseTab);

const initializationPromise = initialize();

function handleMessage(message, _sender, sendResponse) {
  if (message?.type !== SAVE_STATE_MESSAGE) return;

  let nextState;
  try {
    nextState = loadStoredState(message.state);
  } catch (error) {
    sendResponse({ error: error instanceof Error ? error.message : String(error) });
    return;
  }

  const activeGroup = Number.isInteger(message.activeGroup) && nextState[message.activeGroup]
    ? message.activeGroup
    : 0;
  pendingStateWrites.push({ activeGroup, nextState, sendResponse });
  if (!stateWriterRunning) stateWriterPromise = processStateWrites();

  return true;
}

async function processStateWrites() {
  stateWriterRunning = true;
  try {
    await initializationPromise;

    while (pendingStateWrites.length > 0) {
      const batch = pendingStateWrites;
      pendingStateWrites = [];
      const { activeGroup, nextState } = batch[batch.length - 1];
      const stateChangeVersionBeforeSave = stateChangeVersion;

      try {
        const stateWithLiveTabs = await keepLiveTabIds(nextState);
        await chrome.storage.sync.set({
          [GROUP_KEY]: activeGroup,
          [STATE_KEY]: stateWithLiveTabs,
        });
        if (stateChangeVersionBeforeSave === stateChangeVersion) state = stateWithLiveTabs;
        respondToStateWrites(batch, { ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respondToStateWrites(batch, { error: message });
      }
    }
  } catch (error) {
    const batch = pendingStateWrites;
    const message = error instanceof Error ? error.message : String(error);
    pendingStateWrites = [];
    respondToStateWrites(batch, { error: message });
  } finally {
    stateWriterRunning = false;
    if (pendingStateWrites.length > 0) stateWriterPromise = processStateWrites();
  }
}

async function keepLiveTabIds(nextState) {
  const tabs = await chrome.tabs.query({});
  const liveTabIds = new Set(tabs
    .filter(({ id }) => Number.isInteger(id))
    .map(({ id }) => String(id)));

  return nextState.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      tabIds: item.tabIds.filter((tabId) => liveTabIds.has(tabId)),
    })),
  }));
}

function respondToStateWrites(batch, response) {
  batch.forEach(({ sendResponse }) => {
    try {
      sendResponse(response);
    } catch {
      // The popup may close before the worker finishes persisting its state.
    }
  });
}

async function initialize() {
  const initialStateChangeVersion = stateChangeVersion;

  try {
    const { [STATE_KEY]: storedState } = await chrome.storage.sync.get(STATE_KEY);

    if (initialStateChangeVersion === stateChangeVersion) {
      if (storedState === undefined) {
        const defaultState = createDefaultState();
        await persistState(defaultState);

        if (initialStateChangeVersion === stateChangeVersion) {
          state = defaultState;
        }
      } else {
        const storedStateNormalized = loadStoredState(storedState);

        if (Array.isArray(storedState)) {
          state = storedStateNormalized;
        } else {
          await persistState(storedStateNormalized);

          if (initialStateChangeVersion === stateChangeVersion) {
            state = storedStateNormalized;
          }
        }
      }
    }
  } catch (error) {
    if (initialStateChangeVersion === stateChangeVersion) {
      state = [];
    }

    console.error('[Header Craft] Failed to load state:', error);
  }

  await queueRulesReconcile(state);

  const initialActiveTabChangeVersion = activeTabChangeVersion;

  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (initialActiveTabChangeVersion === activeTabChangeVersion) {
      currentTabId = activeTab?.id ?? null;
    }
  } catch (error) {
    console.error('[Header Craft] Failed to find the active tab:', error);
  }

  await updateIcon();
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'sync' || !(STATE_KEY in changes)) {
    return;
  }

  stateChangeVersion += 1;
  const storedState = changes[STATE_KEY].newValue;

  try {
    if (storedState === undefined) {
      state = createDefaultState();
      void persistState(state).catch((error) => {
        console.error('[Header Craft] Failed to restore default state:', error);
      });
    } else {
      state = loadStoredState(storedState);
    }
  } catch (error) {
    state = [];
    console.error('[Header Craft] Ignoring malformed state:', error);
  }

  void queueRulesReconcile(state);
  void updateIcon();
}

function handleActiveTabChanged({ tabId }) {
  activeTabChangeVersion += 1;
  currentTabId = tabId;
  void updateIcon();
}

function handleCloseTab(tabId) {
  tabCleanupChain = tabCleanupChain
    .then(() => initializationPromise)
    .then(() => stateWriterPromise)
    .then(() => removeClosedTab(tabId))
    .catch((error) => {
      console.error('[Header Craft] Failed to clean up a closed tab:', error);
    });
}

async function removeClosedTab(tabId) {
  if (!hasTabId(state, tabId)) {
    return;
  }

  const nextState = removeTabId(state, tabId);
  const stateChangeVersionBeforeSave = stateChangeVersion;

  await persistState(nextState);

  if (stateChangeVersionBeforeSave === stateChangeVersion) {
    state = nextState;
  }

  await queueRulesReconcile(state);
  await updateIcon();
}

function persistState(nextState) {
  return chrome.storage.sync.set({ [STATE_KEY]: nextState });
}

function hasTabId(candidateState, tabId) {
  const expectedTabId = String(tabId);

  return candidateState.some((group) =>
    group.items.some((item) =>
      item.tabIds.some((itemTabId) => String(itemTabId) === expectedTabId),
    ),
  );
}

async function updateIcon() {
  const expectedTabId = String(currentTabId);
  const isExtensionActivated = currentTabId !== null && state.some((group) =>
    group.items.some((item) =>
      item.tabIds.some((tabId) => String(tabId) === expectedTabId),
    ),
  );

  try {
    await chrome.action.setIcon({
      path: isExtensionActivated ? ACTIVE_ICON : DEFAULT_ICON,
    });
  } catch (error) {
    console.error('[Header Craft] Failed to update the icon:', error);
  }
}

function queueRulesReconcile(nextState) {
  const desiredRules = makeRulesByState(nextState);

  reconcileChain = reconcileChain
    .then(() => reconcileSessionRules(desiredRules))
    .catch((error) => {
      console.error('[Header Craft] Failed to update session rules:', error);
    });

  return reconcileChain;
}

async function reconcileSessionRules(desiredRules) {
  const currentRules = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = currentRules.map(({ id }) => id);

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds,
      addRules: desiredRules,
    });
  } catch (error) {
    if (removeRuleIds.length > 0) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
      } catch (cleanupError) {
        console.error('[Header Craft] Failed to remove stale session rules:', cleanupError);
      }
    }

    throw error;
  }
}

function makeRulesByState(nextState) {
  return nextState
    .flatMap((group) => group.items)
    .map((item, rowIndex) => {
      const tabIds = normalizeTabIds(item.tabIds);

      if (!HEADER_NAME_PATTERN.test(item.name) || !item.value || tabIds.length === 0) {
        return null;
      }

      return makeRule(rowIndex + 1, item.name, item.value, tabIds);
    })
    .filter(Boolean);
}

function normalizeTabIds(tabIds) {
  return [...new Set(
    tabIds
      .map((tabId) => Number(tabId))
      .filter((tabId) => Number.isSafeInteger(tabId) && tabId > 0),
  )];
}

function makeRule(id, header, value, tabIds) {
  return {
    id,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        {
          header,
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value,
        },
      ],
    },
    condition: {
      tabIds,
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  };
}
