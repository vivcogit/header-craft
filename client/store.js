export class Store {
  key = null;
  state = [];
  activeGroup = 0;

  constructor(key, groupKey, onChangeGroup) {
    if (!key || !groupKey) {
      throw new Error('key and groupKey are required');
    }

    this.key = key;
    this.groupKey = groupKey;
    this.onChangeGroup = onChangeGroup;
  }

  async init() {
    const { [this.groupKey] : group = 0 } = await chrome.storage.sync.get(this.groupKey);
    const { [this.key]: state } = await chrome.storage.sync.get(this.key);

    this.state = state;
    this.activeGroup = group || 0;
  }

  getGroups() {
    return this.state.map((group, ix) => ({
      ix,
      name: group.name,
      isActive: ix === this.activeGroup,
    }));
  }

  getState() {
    return this.state[this.activeGroup];
  }

  updateGroup = (items) => {
    this.state[this.activeGroup].items = items;
    chrome.storage.sync.set({ [this.key]: this.state });
  }

  updateState = (newState) => {
    this.state = newState;
    chrome.storage.sync.set({ [this.key]: this.state });
  }

  setActiveGroup(activeGroup) {
    this.activeGroup = activeGroup;
    chrome.storage.sync.set({ [this.groupKey]: this.activeGroup });
    this.onChangeGroup(this);
  }

  getGroupId() {
    return this.activeGroup;
  }

  changeValue = (itemId, name, value) => {
    const group = this.state[this.activeGroup];

    if (!group?.items[itemId]) {
      console.warn(`Invalid groupId or itemId: ${groupId}, ${itemId}`);
      return
    }

    group.items[itemId] = {
      ...group.items[itemId],
      [name]: value,
    };

    this.updateState(this.state);
  }
}
  