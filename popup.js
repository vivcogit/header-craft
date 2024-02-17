const STATE_KEY = 'state';

let { state = {} } = await chrome.storage.sync.get(STATE_KEY);
let currentTabId;

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    currentTabId = String(tabs[0].id);

    Object.keys(state).forEach((key) => {
        const checkboxEnabled = document.querySelector(`#headersTable [data-id="${key}"] input[name="enabled"]`);

        checkboxEnabled.checked = state[key].tabIds.includes(currentTabId);
    });
});
chrome.tabs.onRemoved.addListener(
    () => {
        const newState = Object.keys(state).reduce((acc, key) => {
            acc[key] = {
                ...state[key],
                tabIds: state[key].tabIds.filter((tabId) => tabId !== currentTabId),
            }
            return acc;
        }, {});
        updateState(newState);
    }
);

Object.entries(state).forEach(([ id, row ]) => addRow(id, row));

// utils
function updateState(newState) {
    state = newState;
    chrome.storage.sync.set({ [STATE_KEY]: newState });
}

function addRow(id, { name, value }) {
    const table = document.getElementById("headersTable");

    const row = table.insertRow();
    row.setAttribute('data-id', id)
    const cellEnabled = row.insertCell();
    const cellName = row.insertCell();
    const cellValue = row.insertCell();

    const checkboxEnabled = document.createElement("input");
    checkboxEnabled.type = "checkbox";
    checkboxEnabled.name = "enabled";
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

    checkboxEnabled.addEventListener("change", (ev) => changeEnabledCheckboxHandler(id, ev.target.checked));
    inputName.addEventListener("input", (ev) => changeValueHandler(id, 'name', ev.target.value));
    inputValue.addEventListener("input", (ev) => changeValueHandler(id, 'value', ev.target.value));
}

function changeValueHandler(id, name, value) {
    updateState({
        ...state,
        [id]: {
            ...state[id],
            [name]: value,
        }
    })
}

function changeEnabledCheckboxHandler(id, checked) {
    const newValue = checked
        ? [...state[id].tabIds, currentTabId]
        : state[id].tabIds.filter((tabId) => tabId !== currentTabId);

    changeValueHandler(id, 'tabIds', newValue);
}
