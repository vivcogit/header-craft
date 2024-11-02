function addRow(table, id, { name, value }, {onChangeEnabled, onChangeValue}) {
    const row = table.insertRow();
    row.setAttribute('data-id', id);

    const cellEnabled = row.insertCell();
    const cellName = row.insertCell();
    const cellValue = row.insertCell();

    const checkboxEnabled = createCheckbox();
    cellEnabled.appendChild(checkboxEnabled);

    const inputName = createTextInput('Header name', name);
    cellName.appendChild(inputName);

    const inputValue = createTextInput('Value', value);
    cellValue.appendChild(inputValue);

    checkboxEnabled.addEventListener('change', (ev) => onChangeEnabled(id, ev.target.checked));
    inputName.addEventListener('input', (ev) => onChangeValue(id, 'name', ev.target.value));
    inputValue.addEventListener('input', (ev) => onChangeValue(id, 'value', ev.target.value));
}

function createCheckbox() {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'enabled';
    return checkbox;
}

function createTextInput(placeholder, value) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    return input;
}

export function cleanTable(table) {
    table.innerHTML = '';
}

export function initializeTable(store, currentTabId) {
    const table = document.getElementById('headersTable');
    if (!table) return;

    cleanTable(table);

    for (const [id, row] of Object.entries(store.state)) {
        addRow(
            table,
            id,
            row,
            {
                onChangeEnabled: getChangeEnabledCheckboxHandler(store, currentTabId),
                onChangeValue: store.changeValue,
            }
        );
    }
}

function getChangeEnabledCheckboxHandler(store, currentTabId) {
    return (id, checked) => {
        const state = store.state;
        const newValue = checked
            ? [...(state[id].tabIds || []), currentTabId]
            : (state[id].tabIds || []).filter((tabId) => tabId !== currentTabId);

        store.changeValue(id, 'tabIds', newValue);
    }
}

export function getCheckboxByRowKey(key) {
    return document.querySelector(`#headersTable [data-id="${key}"] input[name="enabled"]`);
}
