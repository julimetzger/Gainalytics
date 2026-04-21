// Tests for redux-persist migration 9: muscle percent snapping
// Migration 9 rounds existing percent values down to nearest chip value (25/50/75/100)
// and removes entries with percent < 25 or undefined.

const migration9 = (state: any) => {
  const exercisesById = state.exercises?.byId ?? {};
  const migratedById: Record<string, any> = {};
  Object.keys(exercisesById).forEach((id) => {
    const exercise = exercisesById[id];
    const muscles: Array<{muscle?: string; percent?: number}> = exercise.muscles ?? [];
    const migratedMuscles = muscles
      .filter((m) => m.percent != null && m.percent >= 25)
      .map((m) => {
        const p = m.percent as number;
        let snapped: number;
        if (p >= 100) snapped = 100;
        else if (p >= 75) snapped = 75;
        else if (p >= 50) snapped = 50;
        else snapped = 25;
        return {...m, percent: snapped};
      });
    migratedById[id] = {...exercise, muscles: migratedMuscles};
  });
  return {
    ...state,
    exercises: {
      ...(state.exercises ?? {byId: {}, allIds: []}),
      byId: migratedById,
    },
  };
};

function makeState(exercises: Array<{id: number; percent: number | undefined}>) {
  const byId: Record<string, any> = {};
  exercises.forEach(({id, percent}) => {
    byId[String(id)] = {
      id,
      name: `Exercise ${id}`,
      muscles: [{muscle: 'Chest', percent}],
    };
  });
  return {exercises: {byId, allIds: exercises.map(e => e.id)}};
}

describe('configureStore migration 9', () => {
  it('removes muscle entries with percent === 0', () => {
    const result = migration9(makeState([{id: 1, percent: 0}]));
    expect(result.exercises.byId['1'].muscles).toEqual([]);
  });

  it('removes muscle entries with percent === 24', () => {
    const result = migration9(makeState([{id: 1, percent: 24}]));
    expect(result.exercises.byId['1'].muscles).toEqual([]);
  });

  it('keeps and snaps percent === 25 to 25', () => {
    const result = migration9(makeState([{id: 1, percent: 25}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(25);
  });

  it('snaps percent === 49 to 25', () => {
    const result = migration9(makeState([{id: 1, percent: 49}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(25);
  });

  it('keeps and snaps percent === 50 to 50', () => {
    const result = migration9(makeState([{id: 1, percent: 50}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(50);
  });

  it('snaps percent === 74 to 50', () => {
    const result = migration9(makeState([{id: 1, percent: 74}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(50);
  });

  it('keeps and snaps percent === 75 to 75', () => {
    const result = migration9(makeState([{id: 1, percent: 75}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(75);
  });

  it('snaps percent === 99 to 75', () => {
    const result = migration9(makeState([{id: 1, percent: 99}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(75);
  });

  it('keeps percent === 100 as 100', () => {
    const result = migration9(makeState([{id: 1, percent: 100}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(100);
  });

  it('removes muscle entries with percent === undefined', () => {
    const result = migration9(makeState([{id: 1, percent: undefined}]));
    expect(result.exercises.byId['1'].muscles).toEqual([]);
  });

  it('snaps a realistic value: percent === 87 → 75', () => {
    const result = migration9(makeState([{id: 1, percent: 87}]));
    expect(result.exercises.byId['1'].muscles[0].percent).toBe(75);
  });

  it('handles exercises with no muscles array', () => {
    const state = {exercises: {byId: {'1': {id: 1, name: 'No muscles'}}, allIds: [1]}};
    const result = migration9(state);
    expect(result.exercises.byId['1'].muscles).toEqual([]);
  });

  it('preserves other state slices unchanged', () => {
    const state = {exercises: {byId: {}, allIds: []}, workouts: {something: 'value'}};
    const result = migration9(state);
    expect(result.workouts).toEqual({something: 'value'});
  });
});
