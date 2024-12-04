import { Item, State } from "../types";

export class Store {
  key: string;
  groupKey: string;
  state: State = [];
  activeGroup: number = 0;
  onChangeGroup: (store: Store) => void;

  constructor(key: string, groupKey: string, onChangeGroup: (store: Store) => void) {
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

  updateActiveGroup = (items: Item[]) => {
    this.state[this.activeGroup].items = items;
    chrome.storage.sync.set({ [this.key]: this.state });
  }

  updateState = (newState: State) => {
    this.state = newState;
    chrome.storage.sync.set({ [this.key]: this.state });
  }

  setActiveGroup(activeGroup: number) {
    this.activeGroup = activeGroup;
    chrome.storage.sync.set({ [this.groupKey]: this.activeGroup });
    this.onChangeGroup(this);
  }

  getGroupId() {
    return this.activeGroup;
  }

  changeValue = (itemId: number, name: string, value: string | string[]) => {
    const group = this.state[this.activeGroup];

    if (!group?.items[itemId]) {
      console.warn(`Invalid groupId or itemId: ${this.activeGroup}, ${itemId}`);
      return
    }

    group.items[itemId] = {
      ...group.items[itemId],
      [name]: value,
    };

    this.updateState(this.state);
  }
}
  