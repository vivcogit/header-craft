let { enabled = false } = await chrome.storage.sync.get("enabled");
let { state = {} } = await chrome.storage.sync.get("state");

const globalEnabledCheckbox = document.getElementById("enabled");

globalEnabledCheckbox.checked = Boolean(enabled);

globalEnabledCheckbox.addEventListener("change", (event) => {
    enabled = event.target.checked;
    chrome.storage.sync.set({ enabled });
});

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
    inputName.value = value;
    cellName.appendChild(inputName);

    const inputValue = document.createElement("input");
    inputValue.type = "text";
    inputValue.placeholder = "Value";
    inputValue.value = name;
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
