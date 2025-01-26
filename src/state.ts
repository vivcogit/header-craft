export type Item = {
    tabIds: string[],
    name: string;
    value: string;
    comment: string;
}

export type Group = {
    name: string;
    items: Item[];
}

export class State {
    items: Group[];

    constructor(items: Group[] = []) {
        this.items = items;
    }

    setItems = (items: Group[] = []) => {
        this.items = items;
    }

    getItems = () => this.items;

    removeTabId = (removeTabId: string) => {
        this.items = this.items.map((group) => ({
            ...group,
            items: group.items.map((item) => ({
                ...item,
                tabIds: item.tabIds?.filter((tabId) => tabId !== removeTabId),
            })),
        }));
    }

    getCleanItems = () => {
        return this.getItems().map((group) => ({
            ...group,
            items: group.items.map((item) => ({ ...item, tabIds: [] })),
        }));
    }
}
