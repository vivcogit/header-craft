const DEFAULT_GROUP_COUNT = 3;
const DEFAULT_ROW_COUNT = 5;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeString(value, path, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string') throw new TypeError(`${path} must be a string`);
  return value;
}

function normalizeItem(item, path, preserveTabIds) {
  if (!isObject(item)) throw new TypeError(`${path} must be an object`);

  let tabIds = [];
  if (preserveTabIds && item.tabIds !== undefined) {
    const hasInvalidTabId = !Array.isArray(item.tabIds)
      || item.tabIds.some((id) => typeof id !== 'string' || !/^\d+$/.test(id));

    if (hasInvalidTabId) {
      throw new TypeError(`${path}.tabIds must contain tab ID strings`);
    }
    tabIds = [...item.tabIds];
  }

  return {
    tabIds,
    name: normalizeString(item.name, `${path}.name`),
    value: normalizeString(item.value, `${path}.value`),
    comment: normalizeString(item.comment, `${path}.comment`, true),
  };
}

function normalizeGroups(raw, preserveTabIds) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new TypeError('state must be a non-empty array of groups');
  }

  return raw.map((group, groupIndex) => {
    const path = `state[${groupIndex}]`;
    if (!isObject(group)) throw new TypeError(`${path} must be an object`);
    if (!Array.isArray(group.items)) throw new TypeError(`${path}.items must be an array`);

    return {
      name: group.name === undefined
        ? String(groupIndex)
        : normalizeString(group.name, `${path}.name`),
      items: group.items.map((item, itemIndex) =>
        normalizeItem(item, `${path}.items[${itemIndex}]`, preserveTabIds)
      ),
    };
  });
}

function normalizeLegacyState(raw, preserveTabIds) {
  if (!isObject(raw) || Object.keys(raw).length === 0) {
    throw new TypeError('legacy state must be a non-empty object');
  }

  const state = createDefaultState();
  state[0].items = Object.values(raw).map((item, itemIndex) =>
    normalizeItem(item, `state.${itemIndex}`, preserveTabIds)
  );
  return state;
}

export function createDefaultState() {
  return Array.from({ length: DEFAULT_GROUP_COUNT }, (_, groupIndex) => ({
    name: String(groupIndex),
    items: Array.from({ length: DEFAULT_ROW_COUNT }, () => ({
      tabIds: [],
      name: '',
      value: '',
      comment: '',
    })),
  }));
}

export function loadStoredState(raw) {
  if (raw === undefined) return createDefaultState();
  return Array.isArray(raw)
    ? normalizeGroups(raw, true)
    : normalizeLegacyState(raw, true);
}

export function importProfile(raw) {
  return Array.isArray(raw)
    ? normalizeGroups(raw, false)
    : normalizeLegacyState(raw, false);
}

export function serializeProfile(state) {
  return normalizeGroups(state, true).map((group) => ({
    name: group.name,
    items: group.items.map(({ tabIds, ...item }) => item),
  }));
}

export function removeTabId(state, tabId) {
  const id = String(tabId);
  return loadStoredState(state).map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      tabIds: item.tabIds.filter((storedId) => storedId !== id),
    })),
  }));
}
