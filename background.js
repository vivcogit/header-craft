const DEFAULT_STATE = {
  1: { enabled: false, name: '', value: '' },
  2: { enabled: false, name: '', value: '' },
  3: { enabled: false, name: '', value: '' },
};

let { state } = chrome.storage.sync.get("state") || {};
let { enabled = {} } = chrome.storage.sync.get("enabled") || {};

if (!state) {
  state = DEFAULT_STATE;
  chrome.storage.sync.set({ state });
}

updateRules(state, getTabIds(enabled));

chrome.storage.onChanged.addListener(handleStorageChange);

function getTabIds(enabledState) {
  const tabIds = Object.entries(enabledState).filter(([_, enabled]) => enabled).map(([tabId]) => Number.parseInt(tabId, 10))

  if (tabIds.length === 0) {
    return undefined;
  }

  return tabIds;
}

function handleStorageChange(changes, ...args) {
  Object.keys(changes).forEach((key) => {
    switch (key) {
      case 'enabled':
        enabled = changes.enabled.newValue;

        if (Object.keys(enabled).length) {
          updateRules(state, getTabIds(enabled));
        } else {
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: getIds(state),
          });
        }
        break;
      case 'state':
        state = changes.state.newValue;

        updateRules(state, getTabIds(enabled));
        break;
    }
  })
}

function getIds(state) {
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
      tabIds,
    },
  }
}

function updateRules(state, tabIds) {
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: Object
      .entries(state)
      .filter(([_, row]) => row.enabled && row.name && row.value)
      .map(([id, row]) => getRule(id, row.name, row.value, tabIds)),
    removeRuleIds: getIds(state),
  });
}
