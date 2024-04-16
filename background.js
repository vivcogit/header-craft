const DEFAULT_STATE = {
  "1": { tabIds: [], name: '', value: '' },
  "2": { tabIds: [], name: '', value: '' },
  "3": { tabIds: [], name: '', value: '' },
};
const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';

const STATE_KEY = 'state';

let currentTabId, state;
const allResourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

chrome.storage.sync.get(STATE_KEY).then(init);

function init({ state: storageState }) {
  state = storageState;

  if (!state) {
    state = DEFAULT_STATE;
    chrome.storage.sync.set({ [STATE_KEY]: state });
  }

  updateRules(state);
  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.tabs.onActivated.addListener(handleActiveTabChanged);
}

// utils
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

function getRule(id, header, value, tabIds) {
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
      tabIds: tabIds.map((tabId) => Number.parseInt(tabId)),
      resourceTypes: allResourceTypes,
    },
  }
}

function getRules(state) {
  return Object
    .entries(state)
    .filter(([_, { name, value, tabIds }]) => tabIds.length > 0 && name && value)
    .map(([id, { name, value, tabIds }]) => getRule(id, name, value, tabIds));
}

function updateRules(state) {
  const rules = getRules(state);

  chrome.declarativeNetRequest.updateSessionRules({
    addRules: rules,
    removeRuleIds: getStateIds(state),
  });
}
