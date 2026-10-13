import fs from 'fs';
import path from 'path';
import rootReducer, {GlobalState} from '../../app/redux/rootReducer';
import {PROGRAM_TEMPLATES} from '../../app/constants/programTemplates';
import {buildTemplatePlanPayload} from '../../app/utils/program-templates';
import {selectAllExercises} from '../../app/redux/Exercises/use/useAllExercises';
import {selectAllTimeOneRepMaxLookup} from '../../app/redux/Workout/use/useAllTimeOneRepMax';

const reduce = (state: GlobalState | undefined, action: any): GlobalState => (rootReducer as any)(state, action);

const freshInstall = (): GlobalState => reduce(undefined, {type: '@@INIT'});

const baseline = (): GlobalState => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../testdata/1772318214222.gains'), 'utf8'));
  return reduce(freshInstall(), {type: 'FULL_IMPORT', state: fixture});
};

const addPlan = (state: GlobalState, name: string) => reduce(state, {type: 'ADD_TRAININGS_PLAN', trainingsPlan: {name}});

describe('the current trainings plan (GH-518)', () => {
  it('is not set on a fresh install or by importing a backup without one (no migration)', () => {
    expect(freshInstall().settings.currentTrainingsPlanId).toBeUndefined();
    expect(baseline().settings.currentTrainingsPlanId).toBeUndefined();
  });

  it('makes the first plan of an empty app the current plan', () => {
    const state = addPlan(freshInstall(), 'Kraftblock');

    expect(state.trainingsPlan.allIds).toEqual([1]);
    expect(state.settings.currentTrainingsPlanId).toBe(1);
  });

  it('makes a newly created plan the current one when other plans exist', () => {
    const before = baseline();
    const after = addPlan(before, 'Kraftblock');

    const newId = after.trainingsPlan.allIds.find((id) => !before.trainingsPlan.allIds.includes(id))!;
    expect(after.trainingsPlan.byId[newId].name).toBe('Kraftblock');
    expect(after.settings.currentTrainingsPlanId).toBe(newId);
  });

  it('makes a plan created from a template or a plan file the current one', () => {
    const before = baseline();
    const template = PROGRAM_TEMPLATES.find((t) => t.id === 'strength-block')!;
    const payload = buildTemplatePlanPayload(template, {
      existingExercises: selectAllExercises(before),
      oneRepMaxFor: selectAllTimeOneRepMaxLookup(before),
    });

    const withoutReservedId = reduce(before, {type: 'IMPORT_TRAININGS_PLAN', payload});
    const newId = withoutReservedId.trainingsPlan.allIds.find((id) => !before.trainingsPlan.allIds.includes(id))!;
    expect(withoutReservedId.settings.currentTrainingsPlanId).toBe(newId);

    expect(reduce(before, {type: 'IMPORT_TRAININGS_PLAN', payload, planId: 42}).settings.currentTrainingsPlanId).toBe(42);
  });

  it('switches with the star and leaves other settings untouched', () => {
    const before = addPlan(addPlan(freshInstall(), 'A'), 'B');
    const after = reduce(before, {type: 'SET_CURRENT_TRAININGS_PLAN', trainingsPlanId: 1});

    expect(before.settings.currentTrainingsPlanId).toBe(2);
    expect(after.settings.currentTrainingsPlanId).toBe(1);
    expect({...after.settings, currentTrainingsPlanId: 2}).toEqual(before.settings);
  });

  it('is cleared when the current plan is deleted, and kept when another plan is deleted', () => {
    const state = addPlan(addPlan(freshInstall(), 'A'), 'B');

    expect(reduce(state, {type: 'DELETE_TRAININGS_PLAN', trainingsPlanId: 1}).settings.currentTrainingsPlanId).toBe(2);
    expect(reduce(state, {type: 'DELETE_TRAININGS_PLAN', trainingsPlanId: 2}).settings.currentTrainingsPlanId).toBeUndefined();
  });

  it('does not change on renaming a plan', () => {
    const state = addPlan(addPlan(freshInstall(), 'A'), 'B');

    expect(reduce(state, {type: 'EDIT_TRAININGS_PLAN', trainingsPlanId: 1, name: 'A2'}).settings.currentTrainingsPlanId).toBe(2);
  });
});
