import fs from 'fs';
import path from 'path';
import rootReducer, {GlobalState} from '../../app/redux/rootReducer';
import {PROGRAM_TEMPLATES} from '../../app/constants/programTemplates';
import {buildTemplatePlanPayload, templateStructure} from '../../app/utils/program-templates';
import {selectAllTimeOneRepMax, selectAllTimeOneRepMaxLookup} from '../../app/redux/Workout/use/useAllTimeOneRepMax';
import {selectAllExercises} from '../../app/redux/Exercises/use/useAllExercises';
import {selectShouldShowOnboarding} from '../../app/redux/settings/use/useShouldShowOnboarding';

const reduce = (state: GlobalState | undefined, action: any): GlobalState => (rootReducer as any)(state, action);

const freshInstall = (): GlobalState => reduce(undefined, {type: '@@INIT'});

const createFromTemplate = (state: GlobalState, templateId: string, planId?: number): GlobalState => {
  const template = PROGRAM_TEMPLATES.find((t) => t.id === templateId)!;
  const payload = buildTemplatePlanPayload(template, {
    existingExercises: selectAllExercises(state),
    oneRepMaxFor: selectAllTimeOneRepMaxLookup(state),
  });
  return reduce(state, {type: 'IMPORT_TRAININGS_PLAN', payload, planId});
};

const baseline = (): GlobalState => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../testdata/1772318214222.gains'), 'utf8'));
  return reduce(freshInstall(), {type: 'FULL_IMPORT', state: fixture});
};

describe('creating a plan from a template (GH-497)', () => {
  it('reuses the default exercises of a fresh install and only adds the missing ones', () => {
    const before = freshInstall();
    const after = createFromTemplate(before, 'strength-block');

    const added = after.exercises.allIds.filter((id) => !before.exercises.allIds.includes(id)).map((id) => after.exercises.byId[id].name);
    expect(added).toEqual(['Romanian Deadlift']);
    expect(after.trainingsPlan.allIds).toEqual([1]);
    expect(after.trainingsPlan.byId[1]).toEqual(
      expect.objectContaining({
        id: 1,
        name: 'Strength Block',
        trainingNames: {'1': 'Squat & Bench', '2': 'Deadlift & Press', '3': 'Bench & Squat Volume'},
        mesos: [
          {id: 1, name: 'Volume', order: 1, startMicro: 1},
          {id: 2, name: 'Strength', order: 2, startMicro: 5},
        ],
      }),
    );
  });

  it('creates no duplicate exercises when a second template or the same one again is added', () => {
    const once = createFromTemplate(freshInstall(), 'strength-block');
    const twice = createFromTemplate(createFromTemplate(once, 'hypertrophy-block'), 'strength-block');

    const names = twice.exercises.allIds.map((id) => twice.exercises.byId[id].name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(twice.exercises.allIds.length).toBe(once.exercises.allIds.length + 1); // + Incline Dumbbell Press
    expect(twice.trainingsPlan.allIds).toEqual([1, 2, 3]);
  });

  it('creates the plan under the id reserved by the caller, or the next free one if it is taken', () => {
    const reserved = createFromTemplate(baseline(), 'strength-block', 42);
    expect(reserved.trainingsPlan.byId[42]).toEqual(expect.objectContaining({id: 42, name: 'Strength Block'}));

    const taken = createFromTemplate(reserved, 'hypertrophy-block', 42);
    expect(taken.trainingsPlan.byId[42].name).toBe('Strength Block');
    expect(taken.trainingsPlan.byId[43]).toEqual(expect.objectContaining({id: 43}));
  });

  it('stores the planned sets as planned workouts, never as logged ones', () => {
    const after = createFromTemplate(freshInstall(), 'full-body-starter');
    const {trainings} = templateStructure(PROGRAM_TEMPLATES.find((t) => t.id === 'full-body-starter')!);

    expect(after.workouts.allIds).toEqual([]);
    expect(after.workouts.plannedWorkouts.length).toBeGreaterThan(0);
    expect(after.trainings.allIds).toHaveLength(trainings);
    const firstTraining = after.trainings.byId[after.trainingsPlan.byId[1].trainings['1,1']];
    const squatId = after.exercises.allIds.find((id) => after.exercises.byId[id].name === 'Squat')!;
    expect(after.workouts.byId[firstTraining.plannedWorkouts[squatId]].sets).toEqual([
      {index: 1, reps: 5, repsMax: 8, rir: 3, weight: 0},
      {index: 2, reps: 5, repsMax: 8, rir: 3, weight: 0},
      {index: 3, reps: 5, repsMax: 8, rir: 3, weight: 0},
    ]);
  });

  it('suggests weights from the 1RM the user already has (baseline data)', () => {
    const state = baseline();
    const after = createFromTemplate(state, 'full-body-starter');
    const squatId = state.exercises.allIds.find((id) => state.exercises.byId[id].name === 'Squat')!;
    const oneRepMax = selectAllTimeOneRepMax(state, squatId);
    expect(oneRepMax).toBeGreaterThan(0);

    const plan = after.trainingsPlan.byId[after.trainingsPlan.allIds[after.trainingsPlan.allIds.length - 1]];
    const firstTraining = after.trainings.byId[plan.trainings['1,1']];
    const squatSet = after.workouts.byId[firstTraining.plannedWorkouts[squatId]].sets[0];
    // 5 reps @ 3 RIR = 8 rep max → 1RM / (1 + 8/30), rounded down to 2.5 kg
    expect(squatSet.weight).toBe(Math.floor(oneRepMax / (1 + 8 / 30) / 2.5) * 2.5);
    expect(squatSet.weight).toBeGreaterThan(0);
  });
});

describe('onboarding visibility (GH-497)', () => {
  it('shows on a fresh install, and never again once completed', () => {
    const fresh = freshInstall();
    expect(selectShouldShowOnboarding(fresh)).toBe(true);
    const completed = reduce(fresh, {type: 'COMPLETE_ONBOARDING'});
    expect(selectShouldShowOnboarding(completed)).toBe(false);
    expect(completed.settings).toEqual({...fresh.settings, onboardingCompleted: true, onboardingRequested: false});
  });

  it('does not show for an existing user with data (update without the flag)', () => {
    const state = baseline();
    expect(state.settings.onboardingCompleted).toBeUndefined();
    expect(selectShouldShowOnboarding(state)).toBe(false);
  });

  it('can be reopened from the Settings even with data, and closes again when completed', () => {
    const requested = reduce(baseline(), {type: 'SHOW_ONBOARDING'});
    expect(selectShouldShowOnboarding(requested)).toBe(true);
    expect(selectShouldShowOnboarding(reduce(requested, {type: 'COMPLETE_ONBOARDING'}))).toBe(false);
  });

  it('stays completed when a full backup from before the onboarding is imported', () => {
    const completed = reduce(freshInstall(), {type: 'COMPLETE_ONBOARDING'});
    const emptyBackup = {...freshInstall(), settings: {mode: 'dark'}};
    const imported = reduce(completed, {type: 'FULL_IMPORT', state: emptyBackup});
    expect(imported.settings).toEqual({mode: 'dark', onboardingCompleted: true});
    expect(selectShouldShowOnboarding(imported)).toBe(false);
  });

  it('counts a plan created right after skipping as data', () => {
    const withPlan = createFromTemplate(freshInstall(), 'full-body-starter');
    expect(selectShouldShowOnboarding(withPlan)).toBe(false);
  });
});
