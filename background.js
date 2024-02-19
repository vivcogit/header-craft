const DEFAULT_STATE = {
  "1": { tabIds: [], name: '', value: '' },
  "2": { tabIds: [], name: '', value: '' },
  "3": { tabIds: [], name: '', value: '' },
};
const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';

const STATE_KEY = 'state';

let { state } = chrome.storage.sync.get(STATE_KEY) || {};
let currentTabId;

if (!state) {
  state = DEFAULT_STATE;
  chrome.storage.sync.set({ [STATE_KEY]: state });
}

updateRules(state);

chrome.storage.onChanged.addListener(handleStorageChange);
chrome.tabs.onActivated.addListener(handleActiveTabChanged);

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
      type: 'modifyHeaders',
      requestHeaders: [
        { 
          header, 
          operation: 'set', 
          value,
        },
      ],
    },
    condition: {
      regexFilter: '|http*',
      tabIds: tabIds.map((tabId) => Number.parseInt(tabId)),
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
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: getRules(state),
    removeRuleIds: getStateIds(state),
  });
}
