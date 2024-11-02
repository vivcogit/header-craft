import { saveStateToFile, openJsonFile } from './client/files.js';
import { getCheckboxByRowKey, initializeTable } from './client/ui.js';
import { Store } from './client/store.js';

const STATE_KEY = 'state';
const store = new Store(STATE_KEY);
await store.init();

let currentTabId;

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const state = store.state;

    currentTabId = String(tabs[0].id);

    initializeTable(store, currentTabId);

    Object.keys(state).forEach((key) => {
        const checkboxEnabled = getCheckboxByRowKey(key);

        checkboxEnabled.checked = state[key].tabIds.includes(currentTabId);
    });

});

const exportBtn = document.getElementById('export');
exportBtn.addEventListener('click', () => saveStateToFile(store.state));

const importBtn = document.getElementById('import');
importBtn.addEventListener('click', () => openJsonFile(importState))

function importState(newState) {
    store.updateState(newState);
    initializeTable(store, currentTabId);
}