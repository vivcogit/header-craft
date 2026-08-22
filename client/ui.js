function addRow(table, id, currentTabId, { comment, name, value, tabIds }, {onChangeEnabled, onChangeValue}) {
    const row = table.insertRow();
    row.setAttribute('data-id', id);

    const rowNumber = id + 1;
    const checkboxEnabled = createCheckbox(
        tabIds?.includes(currentTabId),
        `Enable header ${rowNumber}`,
        (ev) => onChangeEnabled(id, ev.target.checked)
    );
    const commentField = createTextInput(
        'Comment',
        `Comment for header ${rowNumber}`,
        comment,
        'comment',
        (ev) => onChangeValue(id, 'comment', ev.target.value)
    );
    const inputName = createTextInput(
        'Header name',
        `Header name ${rowNumber}`,
        name,
        'name',
        (ev) => onChangeValue(id, 'name', ev.target.value)
    );
    const inputValue = createTextInput(
        'Value',
        `Value for header ${rowNumber}`,
        value,
        'value',
        (ev) => onChangeValue(id, 'value', ev.target.value)
    );

    row.insertCell().appendChild(checkboxEnabled);
    row.insertCell().appendChild(commentField);
    row.insertCell().appendChild(inputName);
    row.insertCell().appendChild(inputValue);
}

function createCheckbox(checked, label, onChange) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'enabled';
    checkbox.setAttribute('aria-label', label);
    checkbox.addEventListener('change', onChange);
    checkbox.checked = checked;
    return checkbox;
}

function createTextInput(placeholder, label, value = '', className, onChange) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.className = className;
    input.setAttribute('aria-label', label);
    input.addEventListener('input', onChange);
    return input;
}

export function cleanTable(table) {
    table.innerHTML = '';
}

export function renderTable(store, currentTabId, onError = console.error) {
    const table = document.getElementById('headersTableBody');
    if (!table) return;

    cleanTable(table);
    const state = store.getState();

    if (!state) return;

    state.items.forEach((item, id) => {
        addRow(
            table,
            id, currentTabId,
            item,
            {
                onChangeEnabled: getChangeEnabledCheckboxHandler(store, currentTabId, onError),
                onChangeValue: (...args) => store.changeValue(...args).catch(onError),
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
    radio.addEventListener('change', () => radio.checked && onChange());

    return radio;
}

function createLabel(classname, forField, text) {
    const label = document.createElement('label');
    label.className = classname;
    label.htmlFor = forField;
    label.textContent = text;

    return label;
}

export function renderGroupSwitcher(store, onSelectGroup) {
    const aside = document.getElementById('aside');
    if (!aside) return;

    aside.innerHTML = '';

    const groups = store.getGroups();

    groups.forEach((group) => {
        aside.appendChild(
            createRadioInput(
                group.ix,
                `groupRadio${group.ix}`,
                group.isActive,
                () => onSelectGroup(group.ix)
            )
        );
        aside.appendChild(createLabel('sidebar-btn', `groupRadio${group.ix}`, group.name));
    });
}

function getChangeEnabledCheckboxHandler(store, currentTabId, onError) {
    return (itemId, checked) => {
        const group = store.getState();
        const newTabIds = checked
            ? [...new Set([...(group.items[itemId].tabIds || []), currentTabId])]
            : (group.items[itemId].tabIds || []).filter((tabId) => tabId !== currentTabId);

        store.changeValue(itemId, 'tabIds', newTabIds).catch(onError);
    }
}
