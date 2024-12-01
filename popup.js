import { saveStateToFile, openJsonFile } from './client/files.js';
import { getCheckboxByRowKey, renderTable, renderGroupSwitcher } from './client/ui.js';
import { Store } from './client/store.js';

const STATE_KEY = 'state';
const GROUP_KEY = 'group';
let currentTabId;

const store = new Store(STATE_KEY, GROUP_KEY, (store) => renderTable(store, currentTabId));
await store.init();

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = String(tabs[0].id);

    renderTable(store, currentTabId);
    renderGroupSwitcher(store);

    store.getState().items.forEach((item, id) => {
        const checkboxEnabled = getCheckboxByRowKey(id);

        checkboxEnabled.checked = item.tabIds.includes(currentTabId);
    });

});

const exportBtn = document.getElementById('export');
exportBtn.addEventListener('click', () => saveStateToFile(store.state));

const importBtn = document.getElementById('import');
importBtn.addEventListener('click', () => openJsonFile(importState))

function importState(newState) {
    store.updateState(newState);
    renderTable(store, currentTabId);
}