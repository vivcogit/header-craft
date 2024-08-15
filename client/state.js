function validateState(state) {
    return true;
}

export function adaptStateForSaving(state) {
    return Object.keys(state).reduce((acc, key) => {
        const { tabIds, ...value } = state[key];
        acc[key] = value;
        return acc;
    }, {});
}
