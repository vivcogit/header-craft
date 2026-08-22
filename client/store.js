import { createDefaultState, loadStoredState } from './state.js';

const EDITABLE_FIELDS = ['name', 'value', 'comment', 'tabIds'];
const SAVE_STATE_MESSAGE = 'save-state';

export class Store {
  state = [];
  activeGroup = 0;
  #desiredState = [];
  #writes = Promise.resolve();

  constructor(
    key,
    groupKey,
    storage = globalThis.chrome?.storage?.sync,
    runtime = globalThis.chrome?.runtime,
  ) {
    if (!key || !groupKey) throw new Error('key and groupKey are required');
    if (!storage?.get || !storage?.set) throw new Error('storage with get and set is required');
    if (!runtime?.sendMessage) throw new Error('runtime with sendMessage is required');

    this.key = key;
    this.groupKey = groupKey;
    this.storage = storage;
    this.runtime = runtime;
  }

  async init() {
    const stored = await this.storage.get([this.key, this.groupKey]);
    const isNew = stored[this.key] === undefined;
    const state = isNew ? createDefaultState() : loadStoredState(stored[this.key]);
    const activeGroup = Number.isInteger(stored[this.groupKey]) && state[stored[this.groupKey]]
      ? stored[this.groupKey]
      : 0;

    if (isNew) await this.storage.set({ [this.key]: state });

    this.state = state;
    this.#desiredState = state;
    this.activeGroup = activeGroup;
    return this;
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

  updateState(newState) {
    const state = loadStoredState(newState);
    return this.#scheduleStateCommit(state);
  }

  setActiveGroup(activeGroup) {
    const group = Number.isInteger(activeGroup) && this.#desiredState[activeGroup]
      ? activeGroup
      : 0;
    return this.#scheduleStateCommit(this.#desiredState, group);
  }

  getGroupId() {
    return this.activeGroup;
  }

  whenIdle() {
    return this.#writes;
  }

  changeValue = (itemId, name, value) => {
    const itemIndex = Number(itemId);
    const group = this.#desiredState[this.activeGroup];
    if (!Number.isInteger(itemIndex) || !group?.items[itemIndex]) {
      throw new RangeError(`Invalid itemId: ${itemId}`);
    }
    if (!EDITABLE_FIELDS.includes(name)) throw new TypeError(`Invalid field: ${name}`);

    const state = this.#desiredState.map((currentGroup, groupIndex) => ({
      ...currentGroup,
      items: groupIndex === this.activeGroup
        ? currentGroup.items.map((item, index) => index === itemIndex ? { ...item, [name]: value } : item)
        : currentGroup.items,
    }));

    return this.#scheduleStateCommit(loadStoredState(state));
  };

  #scheduleStateCommit(
    state,
    activeGroup = state[this.activeGroup] ? this.activeGroup : 0,
  ) {
    this.#desiredState = state;
    const write = this.#sendStateToWorker(state, activeGroup);
    return this.#enqueue(async () => {
      try {
        await write;
        this.state = state;
        this.activeGroup = activeGroup;
        return this;
      } catch (error) {
        if (this.#desiredState === state) this.#desiredState = this.state;
        throw error;
      }
    });
  }

  #sendStateToWorker(state, activeGroup) {
    return new Promise((resolve, reject) => {
      this.runtime.sendMessage({
        type: SAVE_STATE_MESSAGE,
        activeGroup,
        state,
      }, (response) => {
        const runtimeError = this.runtime.lastError;

        if (runtimeError) {
          reject(new Error(runtimeError.message));
        } else if (!response?.ok) {
          reject(new Error(response?.error || 'Unable to save state'));
        } else {
          resolve();
        }
      });
    });
  }

  #enqueue(operation) {
    const result = this.#writes.then(operation);
    this.#writes = result.catch(() => undefined);
    return result;
  }
}
