export function adaptStateForSaving(state) {
    return state.map((group) => ({
      ...group,
      items: group.items.map(({ tabIds, ...item }) => item),
    }));
}
  