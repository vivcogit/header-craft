function addRow(table, id, currentTabId, { comment, name, value, tabIds }, {onChangeEnabled, onChangeValue}) {
    const row = table.insertRow();
    row.setAttribute('data-id', id);

    const checkboxEnabled = createCheckbox(tabIds.includes(currentTabId), (ev) => onChangeEnabled(id, ev.target.checked));
    const commentField = createTextInput('Comment', comment, 'comment', (ev) => onChangeValue(id, 'comment', ev.target.value));
    const inputName = createTextInput('Header name', name, 'name', (ev) => onChangeValue(id, 'name', ev.target.value));
    const inputValue = createTextInput('Value', value, 'value', (ev) => onChangeValue(id, 'value', ev.target.value));

    row.insertCell().appendChild(checkboxEnabled);
    row.insertCell().appendChild(commentField);
    row.insertCell().appendChild(inputName);
    row.insertCell().appendChild(inputValue);
}

function createCheckbox(checked, onChange) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'enabled';
    checkbox.addEventListener('change', onChange);
    checkbox.checked = checked;
    return checkbox;
}

function createTextInput(placeholder, value = '', className, onChange) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.className = className;
    input.addEventListener('input', onChange)
    return input;
}

export function cleanTable(table) {
    table.innerHTML = '';
}

export function renderTable(store, currentTabId) {
    const table = document.getElementById('headersTable');
    if (!table) return;

    cleanTable(table);
    const state = store.getState();

    state.items.forEach((item, id) => {
        addRow(
            table,
            id, currentTabId,
            item,
            {
                onChangeEnabled: getChangeEnabledCheckboxHandler(store, currentTabId),
                onChangeValue: store.changeValue,
            }
        );
    });
}


function createRadioInput(value, id, isActive, onChange) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'groupRadio';
    radio.value = value;
    radio.id = id;
    radio.checked = isActive;
    radio.addEventListener('change', () => radio.checked && onChange())

    return radio;
}

function createLabel(classname, forField, text) {
    const label = document.createElement('label');
    label.className = classname;
    label.htmlFor = forField;
    label.textContent = text;

    return label;
}

export function renderGroupSwitcher(store) {
    const aside = document.getElementById('aside');
    if (!aside) return;

    const groups = store.getGroups();

    groups.forEach((group) => {
        aside.appendChild(
            createRadioInput(
                group.ix,
                `groupRadio${group.ix}`,
                group.isActive,
                () => store.setActiveGroup(group.ix)
            )
        );
        aside.appendChild(createLabel("sidebar-btn", `groupRadio${group.ix}`, group.name));
    });
}

function getChangeEnabledCheckboxHandler(store, currentTabId) {
    return (itemId, checked) => {
        const group = store.getState();
        const newTabIds = checked
            ? [...(group.items[itemId].tabIds || []), currentTabId]
            : (group.items[itemId].tabIds || []).filter((tabId) => tabId !== currentTabId);
    
        store.changeValue(itemId, 'tabIds', newTabIds);
    }
  }
  

export function getCheckboxByRowKey(key) {
    return document.querySelector(`#headersTable [data-id="${key}"] input[name="enabled"]`);
}
