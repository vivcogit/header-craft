const DEFAULT_STATE = {
  1: { enabled: false, name: '', value: '' },
  2: { enabled: false, name: '', value: '' },
  3: { enabled: false, name: '', value: '' },
};

let { state } = chrome.storage.sync.get("state") || {};

if (!state) {
  state = DEFAULT_STATE;
  chrome.storage.sync.set({ state });
}

function handleStorageChange(changes) {
  Object.keys(changes).forEach((key) => {
    switch (key) {
      case 'enabled':
        if (changes.enabled.newValue) {
          updateDynamicRulesByState(state);
        } else {
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: getIds(state),
          });
        }
        break;
      case 'state':
        state = changes.state.newValue;
        updateDynamicRulesByState(state);
        break;
    }
  })
}

chrome.storage.onChanged.addListener(handleStorageChange);

function getIds(state) {
  return Object.keys(state).map((id) => Number.parseInt(id, 10))
}

function getRule(id, header, value) {
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
    },
  }
}

function updateDynamicRulesByState(state) {
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: Object
        .entries(state)
        .filter(([id, row]) => row.enabled)
        .map(([id, row]) => getRule(id, row.name, row.value)),
      removeRuleIds: getIds(state),
    });
}
