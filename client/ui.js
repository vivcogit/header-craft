function addRow(table, id, { name, value }, { onChangeEnabled, onChangeValue }) {
    const row = table.insertRow();
    row.setAttribute('data-id', id)
    const cellEnabled = row.insertCell();
    const cellName = row.insertCell();
    const cellValue = row.insertCell();

    const checkboxEnabled = document.createElement('input');
    checkboxEnabled.type = 'checkbox';
    checkboxEnabled.name = 'enabled';
    cellEnabled.appendChild(checkboxEnabled);

    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.placeholder = 'Header name';
    inputName.value = name;
    cellName.appendChild(inputName);

    const inputValue = document.createElement('input');
    inputValue.type = 'text';
    inputValue.placeholder = 'Value';
    inputValue.value = value;
    cellValue.appendChild(inputValue);

    checkboxEnabled.addEventListener('change', (ev) => onChangeEnabled(id, ev.target.checked));
    inputName.addEventListener('input', (ev) => onChangeValue(id, 'name', ev.target.value));
    inputValue.addEventListener('input', (ev) => onChangeValue(id, 'value', ev.target.value));
}

export function cleanTable(table) {
    const rowCount = table.rows.length;

    for (let i = 1; i < rowCount; i++) {
        table.deleteRow(1);
    }
}

export function initializeTable(store, currentTabId) {
    const table = document.getElementById('headersTable');

    cleanTable(table);

    Object.entries(store.state).forEach(([ id, row ]) => addRow(
        table,
        id,
        row,
        {
            onChangeEnabled: getChangeEnabledCheckboxHandler(store, currentTabId),
            onChangeValue: store.changeValue,
        },
    ));
}

function getChangeEnabledCheckboxHandler(store, currentTabId) {
    return (id, checked) => {
        const state = store.state;

        const newValue = checked
            ? [...state[id].tabIds, currentTabId]
            : state[id].tabIds.filter((tabId) => tabId !== currentTabId);

        store.changeValue(id, 'tabIds', newValue);
    }
}

export function getRowByKey(key) {
    return document.querySelector(`#headersTable [data-id="${key}"] input[name="enabled"]`);
}
