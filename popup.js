let { enabledTabs = [] } = await chrome.storage.sync.get("enabledTabs");
let { state = {} } = await chrome.storage.sync.get("state");
let currentTabId;

const globalEnabledCheckbox = document.getElementById("enabled");

globalEnabledCheckbox.addEventListener("change", (event) => {
    if (event.target.checked) {
        enabledTabs.push(currentTabId);
    } else {
        enabledTabs = enabledTabs.filter((item) => item !== currentTabId);
    }

    chrome.storage.sync.set({ enabledTabs });
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = tabs[0].id;
    globalEnabledCheckbox.checked = Boolean(enabledTabs.includes(currentTabId));
});
chrome.tabs.onRemoved.addListener(
    () => {
        enabledTabs = enabledTabs.filter((item) => item !== currentTabId);
        chrome.storage.sync.set({ enabledTabs });
    }
);

function addRow(id, { name, value, enabled }) {
    const table = document.getElementById("headersTable");

    const row = table.insertRow();
    row.setAttribute('data-id', id)
    const cellEnabled = row.insertCell();
    const cellName = row.insertCell();
    const cellValue = row.insertCell();

    const checkboxEnabled = document.createElement("input");
    checkboxEnabled.type = "checkbox";
    checkboxEnabled.checked = enabled;
    cellEnabled.appendChild(checkboxEnabled);

    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.placeholder = "Header name";
    inputName.value = name;
    cellName.appendChild(inputName);

    const inputValue = document.createElement("input");
    inputValue.type = "text";
    inputValue.placeholder = "Value";
    inputValue.value = value;
    cellValue.appendChild(inputValue);

    checkboxEnabled.addEventListener("change", (ev) => changeValueHandler(id, 'enabled', ev.target.checked));
    inputName.addEventListener("input", (ev) => changeValueHandler(id, 'name', ev.target.value));
    inputValue.addEventListener("input", (ev) => changeValueHandler(id, 'value', ev.target.value));
}

function changeValueHandler(id, name, value) {
    state = {
        ...state,
        [id]: {
            ...state[id],
            [name]: value,
        }
    }

    chrome.storage.sync.set({ state });
}

Object.entries(state).forEach(([ id, row ]) => addRow(id, row));
