export class Store {
    key = null;
    state = null;

    constructor(key) {
        if (!key) {
            throw new Error('key is required');
        }

        this.key = key;
    }

    async init() {
        let { state = {} } = await chrome.storage.sync.get(this.key);
        this.state = state;
    }

    get state() {
        return this.state;
    }

    updateState = (newState) => {
        this.state = newState;
        chrome.storage.sync.set({ [this.key]: newState });
    }

    changeValue = (id, name, value) => {
        this.updateState({
            ...this.state,
            [id]: {
                ...this.state[id],
                [name]: value,
            }
        })
    }
}
