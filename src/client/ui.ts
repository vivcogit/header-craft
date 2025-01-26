import { Item } from "../state";
import { Store } from "./store";

function addRow(
    table: HTMLTableElement,
    id: number,
    currentTabId: string,
    { comment, name, value, tabIds }: Item,
    {
        onChangeEnabled,
        onChangeValue
    }: {
        onChangeEnabled: (itemId: number, checked: boolean) => void,
        onChangeValue: Store['changeValue']
    }
) {
    const row = table.insertRow();
    row.setAttribute('data-id', String(id));

    const checkboxEnabled = createCheckbox(!!tabIds?.includes(currentTabId), (value) => onChangeEnabled(id, value));
    const commentField = createTextInput('Comment', comment, 'comment', (value) => onChangeValue(id, 'comment', value));
    const inputName = createTextInput('Header name', name, 'name', (value) => onChangeValue(id, 'name', value));
    const inputValue = createTextInput('Value', value, 'value', (value) => onChangeValue(id, 'value', value));

    row.insertCell().appendChild(checkboxEnabled);
    row.insertCell().appendChild(commentField);
    row.insertCell().appendChild(inputName);
    row.insertCell().appendChild(inputValue);
}

function createCheckbox(checked: boolean, onChange: (value: boolean) => void) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'enabled';
    checkbox.addEventListener('change', (ev) => onChange((ev.target as HTMLInputElement)?.checked));
    checkbox.checked = checked;
    return checkbox;
}

function createTextInput(placeholder: string, value = '', className: string, onChange: (value: string) => void) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.className = className;
    input.addEventListener('input', (ev) => onChange((ev.target as HTMLInputElement)?.value))
    return input;
}

export function cleanTable(table: HTMLTableElement) {
    table.innerHTML = '';
}

export function renderTable(store: Store, currentTabId: string) {
    const table = document.getElementById('headersTable') as HTMLTableElement | null;
    if (!table) return;

    cleanTable(table);
    const state = store.getState();

    state.items.forEach((item, id) => {
        addRow(
            table,
            id,
            currentTabId,
            item,
            {
                onChangeEnabled: getChangeEnabledCheckboxHandler(store, currentTabId),
                onChangeValue: store.changeValue,
            }
        );
    });
}


function createRadioInput(value: number, id: string, isActive: boolean, onChange: () => void) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'groupRadio';
    radio.value = String(value);
    radio.id = id;
    radio.checked = isActive;
    radio.addEventListener('change', () => radio.checked && onChange())

    return radio;
}

function createLabel(classname: string, forField: string, text: string) {
    const label = document.createElement('label');
    label.className = classname;
    label.htmlFor = forField;
    label.textContent = text;

    return label;
}

export function renderGroupSwitcher(store: Store) {
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

function getChangeEnabledCheckboxHandler(store: Store, currentTabId: string) {
    return (itemId: number, checked: boolean) => {
        const group = store.getState();
        const newTabIds = checked
            ? [...(group.items[itemId].tabIds || []), currentTabId]
            : (group.items[itemId].tabIds || []).filter((tabId) => tabId !== currentTabId);
    
        store.changeValue(itemId, 'tabIds', newTabIds);
    }
  }
  

export function getCheckboxByRowKey(key: number) {
    return document.querySelector(`#headersTable [data-id="${key}"] input[name="enabled"]`) as HTMLInputElement | null;
}
