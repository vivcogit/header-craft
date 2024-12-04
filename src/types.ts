export type Item = {
    tabIds?: string[],
    name: string;
    value: string;
    comment: string;
}

export type Group = {
    name: string;
    items: Item[];
}

export type State = Group[];
