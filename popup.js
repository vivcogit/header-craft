import { openJsonFile, saveStateToFile } from './client/files.js';
import { renderGroupSwitcher, renderTable } from './client/ui.js';
import { Store } from './client/store.js';

const STATE_KEY = 'state';
const GROUP_KEY = 'group';

const store = new Store(STATE_KEY, GROUP_KEY);
const exportBtn = document.getElementById('export');
const importBtn = document.getElementById('import');
const status = document.getElementById('status');

let currentTabId;

exportBtn.disabled = true;
importBtn.disabled = true;

function showStatus(message = '', isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#b00020' : '#176b2c';
}

function showError(error) {
    console.error(error);
    showStatus(error instanceof Error ? error.message : String(error), true);
}

function render() {
    renderTable(store, currentTabId, (error) => {
        showError(error);
        render();
    });
    renderGroupSwitcher(store, async (groupId) => {
        try {
            await store.setActiveGroup(groupId);
            showStatus();
        } catch (error) {
            showError(error);
        }
        render();
    });
}

async function init() {
    const [, tabs] = await Promise.all([
        store.init(),
        chrome.tabs.query({ active: true, currentWindow: true }),
    ]);
    const tabId = tabs[0]?.id;

    if (!Number.isInteger(tabId)) {
        throw new Error('Unable to identify the active tab');
    }

    currentTabId = String(tabId);
    render();
    exportBtn.disabled = false;
    importBtn.disabled = false;
}

exportBtn.addEventListener('click', async () => {
    try {
        await store.whenIdle();
        await saveStateToFile(store.state);
        showStatus('Export started');
    } catch (error) {
        showError(error);
    }
});

importBtn.addEventListener('click', async () => {
    try {
        const importedState = await openJsonFile();

        if (!importedState) return;

        await store.updateState(importedState);
        render();
        showStatus('Import complete');
    } catch (error) {
        showError(error);
    }
});

init().catch(showError);
