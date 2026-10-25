import rootReducer, {GlobalState} from '../../app/redux/rootReducer';
import {BUILT_IN_MUSCLES} from '../../app/models/Muscles';
import {Exercise} from '../../app/models/entities/Exercise';
import {
  addMuscle,
  countExercisesUsingMuscle,
  normalizeMuscleName,
  removeMuscle,
  resolveAvailableMuscles,
  resolveOverviewMuscles,
  setMuscleInOverviews,
  validateMuscleName,
} from '../../app/utils/muscle-catalog';

const freshState = (): GlobalState => rootReducer(undefined, {type: '@@INIT'});

describe('muscle catalog (GH-523)', () => {
  it('keeps exactly the built-in muscles, all in overviews, for installs without muscle settings', () => {
    expect(resolveAvailableMuscles(undefined)).toEqual(['Back', 'Biceps', 'Chest', 'Core', 'Glutes', 'Hamstrings', 'Quads', 'Shoulders', 'Triceps']);
    expect(resolveOverviewMuscles(undefined)).toEqual(BUILT_IN_MUSCLES);
  });

  it('lists kept built-ins first, then the user muscles in the order added, and leaves hidden ones out of the overviews', () => {
    const settings = {custom: ['Calves', 'Forearms'], removed: ['Core', 'Glutes'], hiddenInOverviews: ['Biceps', 'Calves']};

    expect(resolveAvailableMuscles(settings)).toEqual(['Back', 'Biceps', 'Chest', 'Hamstrings', 'Quads', 'Shoulders', 'Triceps', 'Calves', 'Forearms']);
    expect(resolveOverviewMuscles(settings)).toEqual(['Back', 'Chest', 'Hamstrings', 'Quads', 'Shoulders', 'Triceps', 'Forearms']);
  });

  it('validates new names', () => {
    const available = resolveAvailableMuscles(undefined);
    expect([
      validateMuscleName('   ', available),
      validateMuscleName('chest', available),
      validateMuscleName('123', available),
      validateMuscleName('volume', available),
      validateMuscleName('A'.repeat(25), available),
      validateMuscleName('  Rear   delts ', available),
    ]).toEqual([
      'Enter a muscle name.',
      'Chest already exists.',
      'A muscle name needs at least one letter.',
      'volume is already used as a metric name.',
      'Use at most 24 characters.',
      undefined,
    ]);
    expect(normalizeMuscleName('  Rear   delts ')).toBe('Rear delts');
  });

  it('adds a custom muscle under its normalised name and ignores invalid names', () => {
    const settings = {hiddenInOverviews: ['Core']};

    expect(addMuscle(settings, ' Calves ')).toEqual({custom: ['Calves'], hiddenInOverviews: ['Core']});
    expect(addMuscle(settings, 'CORE')).toBe(settings);
  });

  it('restores a removed built-in muscle under its built-in name, shown in the overviews again', () => {
    const settings = {removed: ['Core', 'Glutes'], hiddenInOverviews: ['Core']};

    expect(addMuscle(settings, 'core')).toEqual({removed: ['Glutes'], hiddenInOverviews: []});
  });

  it('removes built-in and custom muscles and forgets their overview choice', () => {
    const settings = {custom: ['Calves', 'Forearms'], hiddenInOverviews: ['Calves', 'Back']};

    expect(removeMuscle(settings, 'Calves')).toEqual({custom: ['Forearms'], hiddenInOverviews: ['Back']});
    expect(removeMuscle(settings, 'Back')).toEqual({custom: ['Calves', 'Forearms'], removed: ['Back'], hiddenInOverviews: ['Calves']});
    expect(removeMuscle(settings, 'Neck')).toBe(settings);
  });

  it('hides and shows a muscle in the overviews', () => {
    const hidden = setMuscleInOverviews(undefined, 'Biceps', false);

    expect(hidden).toEqual({hiddenInOverviews: ['Biceps']});
    expect(setMuscleInOverviews(hidden, 'Biceps', false)).toBe(hidden);
    expect(setMuscleInOverviews(hidden, 'Biceps', true)).toEqual({hiddenInOverviews: []});
    expect(setMuscleInOverviews(undefined, 'Neck', false)).toBeUndefined();
  });

  it('counts the exercises that use a muscle', () => {
    const exercises = [
      {name: 'a', muscles: [{muscle: 'Calves', percent: 100}]},
      {name: 'b', muscles: [{muscle: 'Calves', percent: 0}]},
      {name: 'c', muscles: [{muscle: 'Back', percent: 50}]},
    ] satisfies Exercise[];

    expect(countExercisesUsingMuscle(exercises, 'Calves')).toBe(1);
  });
});

describe('muscle actions in the store (GH-523)', () => {
  it('ADD_MUSCLE and SET_MUSCLE_IN_OVERVIEWS write the muscle settings', () => {
    let state = rootReducer(freshState(), {type: 'ADD_MUSCLE', muscle: 'Calves'});
    state = rootReducer(state, {type: 'SET_MUSCLE_IN_OVERVIEWS', muscle: 'Chest', visible: false});

    expect(state.settings.muscles).toEqual({custom: ['Calves'], hiddenInOverviews: ['Chest']});
  });

  it('a rejected muscle change keeps the settings object', () => {
    const state = freshState();

    expect(rootReducer(state, {type: 'ADD_MUSCLE', muscle: 'chest'}).settings).toBe(state.settings);
  });

  it('REMOVE_MUSCLE drops the muscle from the list and from every exercise, other muscles stay', () => {
    const before = freshState();
    // Default exercise 1 (Bench Press) trains Chest 100 / Triceps 70 / Shoulders 10.
    const after = rootReducer(before, {type: 'REMOVE_MUSCLE', muscle: 'Triceps'});

    expect(after.settings.muscles).toEqual({removed: ['Triceps'], hiddenInOverviews: []});
    expect(after.exercises.byId[1].muscles).toEqual([
      {muscle: 'Chest', percent: 100},
      {muscle: 'Shoulders', percent: 10},
    ]);
    const stillUsing = after.exercises.allIds.filter((id) => after.exercises.byId[id].muscles?.some((pair) => pair.muscle === 'Triceps'));
    expect(stillUsing).toEqual([]);
    // Exercises that never had the muscle keep their object.
    const untouched = before.exercises.allIds.find((id) => !before.exercises.byId[id].muscles?.some((pair) => pair.muscle === 'Triceps'))!;
    expect(after.exercises.byId[untouched]).toBe(before.exercises.byId[untouched]);
  });
});
