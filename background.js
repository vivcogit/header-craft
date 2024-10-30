const DEFAULT_STATE = {
  "1": { tabIds: [], name: '', value: '' },
  "2": { tabIds: [], name: '', value: '' },
  "3": { tabIds: [], name: '', value: '' },
  "4": { tabIds: [], name: '', value: '' },
  "5": { tabIds: [], name: '', value: '' },
};
const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';

const STATE_KEY = 'state';

let currentTabId, state;

chrome.storage.sync.set({ [STATE_KEY]: DEFAULT_STATE });
chrome.storage.sync.get(STATE_KEY).then(init);

function init({ state: storageState }) {
  if (!storageState) {
    state = DEFAULT_STATE;
    chrome.storage.sync.set({ [STATE_KEY]: state });
  } else {
    state = {
      ...DEFAULT_STATE,
      ...storageState
    };
  }

  updateRules(state);

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = String(tabs[0].id);
  });

  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.tabs.onActivated.addListener(handleActiveTabChanged);
  chrome.tabs.onRemoved.addListener(handleCloseTab);
}

// utils
function handleCloseTab() {
  const newState = Object.keys(state).reduce((acc, key) => {
      acc[key] = {
          ...state[key],
          tabIds: state[key].tabIds?.filter((tabId) => tabId !== currentTabId),
      }
      return acc;
  }, {});

  state = newState;
}

function handleActiveTabChanged({ tabId }) {
  currentTabId = String(tabId);
  updateIcon();
}

function updateIcon() {
  const isExtensionActivated = Object.values(state).some((rule) => rule.tabIds.includes(currentTabId));
  
  chrome.action.setIcon({
    path: isExtensionActivated ? ACTIVE_ICON : DEFAULT_ICON,
  });
}

function handleStorageChange(changes) {
  Object.keys(changes).forEach((key) => {
    switch (key) {
      case STATE_KEY:
        state = changes.state.newValue;

        updateRules(state);
        updateIcon();
        break;
    }
  })
}

function getStateIds(state) {
  return Object.keys(state).map((id) => Number.parseInt(id, 10))
}

function updateRules(state) {
  const rules = makeRulesByState(state);

  chrome.declarativeNetRequest.updateSessionRules({
    addRules: rules,
    removeRuleIds: getStateIds(state),
  });
}

const ALL_RESOURCE_TYPES = Object.values(chrome.declarativeNetRequest.ResourceType);

function makeRule(id, header, value, tabIds) {
    return {
      id: Number.parseInt(id, 10),
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
        tabIds: tabIds.map((tabId) => Number.parseInt(tabId, 10)),
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    }
  }
  
function makeRulesByState(state) {
    return Object
        .entries(state)
        .filter(([_, { name, value, tabIds }]) => tabIds.length > 0 && name && value)
        .map(([id, { name, value, tabIds }]) => makeRule(id, name, value, tabIds));
}
