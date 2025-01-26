import { Group, Item, State } from "./state";

const DEFAULT_ROW_STATE: Item = { tabIds: [], name: '', value: '', comment: '', };
const getDefaultTabState = (name: string): Group => ({
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
  getDefaultTabState('1'),
  getDefaultTabState('2'),
  getDefaultTabState('3'),
];

const DEFAULT_ICON = 'icon_128.png';
const ACTIVE_ICON = 'icon_128-active.png';

const STATE_KEY = 'state';

let currentTabId: string;
let state: State;

chrome.storage.sync.get(STATE_KEY).then(init);

function handleInitionState(storageState: State | null): State {
  if (!Array.isArray(storageState)) {
    return new State(DEFAULT_STATE);
  }

  return new State(storageState);
}

function init(value: { [key: string]: any; }) {
  state = handleInitionState(value['state']);
  chrome.storage.sync.set({ [STATE_KEY]: state });

  updateRules(state);

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = String(tabs[0].id);
  });

  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.tabs.onActivated.addListener(handleActiveTabChanged);
  chrome.tabs.onRemoved.addListener(handleCloseTab);
}

function handleCloseTab() {
  state.removeTabId(currentTabId);
}

function handleActiveTabChanged({ tabId }: { tabId: number }) {
  currentTabId = String(tabId);
  updateIcon();
}

function updateIcon() {
  const isExtensionActivated = state.getItems().some((group) =>
    group.items.some((item) => item.tabIds?.includes(currentTabId))
  );

  chrome.action.setIcon({
    path: isExtensionActivated ? ACTIVE_ICON : DEFAULT_ICON,
  });
}

function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange; }) {
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


function getStateIds(state: State) {
  return state.getItems().flatMap((group, groupIndex) =>
    group.items.map((_, itemIndex) => groupIndex * 100 + itemIndex + 1)
  );
}

function updateRules(state: State) {
  const rules = makeRulesByState(state);

  chrome.declarativeNetRequest.updateSessionRules({
    addRules: rules,
    removeRuleIds: getStateIds(state),
  });
}

const ALL_RESOURCE_TYPES = Object.values(chrome.declarativeNetRequest.ResourceType);

function makeRule(id: number, header: string, value: string, tabIds: string[]) {
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
      tabIds: tabIds?.map((tabId) => Number.parseInt(tabId, 10)),
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  };
}
  
function makeRulesByState(state: State) {
  return state.getItems().flatMap((group, groupIndex) =>
    group.items
      .filter(({ name, value, tabIds }) => tabIds?.length && name && value)
      .map((item, itemIndex) =>
        makeRule(groupIndex * 100 + itemIndex + 1, item.name, item.value, item.tabIds || [])
      )
  );
}