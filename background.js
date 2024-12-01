const DEFAULT_ROW_STATE = { tabIds: [], name: '', value: '', comment: '', };
const getDefaultTabState = (name) => ({
  name: name.toString(),
  items: [
    DEFAULT_ROW_STATE,
    DEFAULT_ROW_STATE,
    DEFAULT_ROW_STATE,
    DEFAULT_ROW_STATE,
    DEFAULT_ROW_STATE,
  ]
});

const DEFAULT_STATE = [
  getDefaultTabState(0),
  getDefaultTabState(1),
  getDefaultTabState(2),
];

const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';

const STATE_KEY = 'state';

let currentTabId, state;

chrome.storage.sync.get(STATE_KEY).then(init);

function handleInitionState(storageState) {
  if (!storageState) {
    return DEFAULT_STATE;
  }

  if (Array.isArray(storageState)) {
    return storageState;
  }


  // old state to new state, TODO remove after some time
  return [
    {
      ...getDefaultTabState,
      items: Object.values(storageState),
    }
  ]
}

function init({ state: storageState }) {
  state = handleInitionState(storageState);
  chrome.storage.sync.set({ [STATE_KEY]: state });

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
  state = state.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      tabIds: item.tabIds?.filter((tabId) => tabId !== currentTabId),
    })),
  }));
}

function handleActiveTabChanged({ tabId }) {
  currentTabId = String(tabId);
  updateIcon();
}

function updateIcon() {
  const isExtensionActivated = state.some((group) =>
    group.items.some((item) => item.tabIds.includes(currentTabId))
  );

  chrome.action.setIcon({
    path: isExtensionActivated ? ACTIVE_ICON : DEFAULT_ICON,
  });
}

function handleStorageChange(changes) {
  Object.keys(changes).forEach((key) => {
    switch (key) {
      case STATE_KEY:
        state = changes[STATE_KEY].newValue;

        updateRules(state);
        updateIcon();
        break;
    }
  });
}


function getStateIds(state) {
  return state.flatMap((group, groupIndex) =>
    group.items.map((_, itemIndex) => groupIndex * 100 + itemIndex + 1)
  );
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
      tabIds: tabIds.map((tabId) => Number.parseInt(tabId, 10)),
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  };
}
  
function makeRulesByState(state) {
  return state.flatMap((group, groupIndex) =>
    group.items
      .filter(({ name, value, tabIds }) => tabIds?.length && name && value)
      .map((item, itemIndex) =>
        makeRule(groupIndex * 100 + itemIndex + 1, item.name, item.value, item.tabIds)
      )
  );
}