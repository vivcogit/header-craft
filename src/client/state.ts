import { State } from "../types";

export function adaptStateForSaving(state: State) {
    return state.map((group) => ({
      ...group,
      items: group.items.map(({ tabIds, ...item }) => item),
    }));
}
  