const DEFAULT_STATE = {
  1: { enabled: false, name: '', value: '' },
  2: { enabled: false, name: '', value: '' },
  3: { enabled: false, name: '', value: '' },
};

let { state } = chrome.storage.sync.get("state") || {};
let { enabledTabs = [] } = chrome.storage.sync.get("enabledTabs") || [];

if (!state) {
  state = DEFAULT_STATE;
  chrome.storage.sync.set({ state });
}

updateRules(state, enabledTabs);

chrome.storage.onChanged.addListener(handleStorageChange);

// utils
function handleStorageChange(changes) {
  Object.keys(changes).forEach((key) => {
    switch (key) {
      case 'enabledTabs':
        enabledTabs = changes.enabledTabs.newValue;

        if (enabledTabs.length) {
          updateRules(state, enabledTabs);
        } else {
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: getStateIds(state),
          });
        }
        break;
      case 'state':
        state = changes.state.newValue;

        updateRules(state, enabledTabs);
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
      tabIds,
    },
  }
}

function getRules(state, tabIds) {
  if (!tabIds.length) {
    return [];
  }

  const rows = Object
    .entries(state)
    .filter(([_, row]) => row.enabled && row.name && row.value);

  console.log({rows})

  return rows.map(([id, row]) => getRule(id, row.name, row.value, tabIds));
}

function updateRules(state, tabIds) {
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: getRules(state, tabIds),
    removeRuleIds: getStateIds(state),
  });
}
