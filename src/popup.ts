import { saveStateToFile, openJsonFile } from './client/files';
import { getCheckboxByRowKey, renderTable, renderGroupSwitcher } from './client/ui';
import { Store } from './client/store';
import { State } from './state';

const STATE_KEY = 'state';
const GROUP_KEY = 'group';
let currentTabId: string;

const store = new Store(STATE_KEY, GROUP_KEY, (store) => renderTable(store, currentTabId));
await store.init();

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = String(tabs[0].id);

    renderTable(store, currentTabId);
    renderGroupSwitcher(store);

    store.getState().items.forEach((item, id) => {
        const checkboxEnabled = getCheckboxByRowKey(id);

        if (checkboxEnabled) {
            checkboxEnabled.checked = !!item.tabIds?.includes(currentTabId);
        }
    });

});

const exportBtn = document.getElementById('export');
exportBtn?.addEventListener('click', () => saveStateToFile(store.state));

const importBtn = document.getElementById('import');
importBtn?.addEventListener('click', () => openJsonFile(importState))

function importState(newState: State) {
    store.updateState(newState);

    renderTable(store, currentTabId);
}