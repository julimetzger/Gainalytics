
export interface NormalizedState<T> {
    byId: { [id: number]: T };
    allIds: number[];
}

export function determineNewId<T extends any>(normalizedState: NormalizedState<T>) {
    if (normalizedState.allIds.length > 0)
        return Math.max(...normalizedState.allIds) + 1;
    else
        return 1;
}
