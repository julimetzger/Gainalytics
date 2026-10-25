import fs from 'fs';
import path from 'path';
import rootReducer, {GlobalState} from '../../app/redux/rootReducer';
import exerciseReducer from '../../app/redux/Exercises/exercisesReducer';
import workoutReducer from '../../app/redux/Workout/workoutReducer';
import trainingsPlanReducer from '../../app/redux/Training/trainingsPlanReducer';
import trainingsReducer from '../../app/redux/Training/trainingsReducer';
import videoAnalysisReducer from '../../app/redux/VideoAnalysis/videoAnalysisReducer';
import bodyWeightReducer from '../../app/redux/BodyWeight/bodyWeightReducer';
import settingsReducer from '../../app/redux/settings/settingsReducer';
import effectsReducer from '../../app/redux/Effects/effectsReducer';
import aiChatReducer from '../../app/redux/AIChat/aiChatSlice';
import {PROGRAM_TEMPLATES} from '../../app/constants/programTemplates';
import {buildTemplatePlanPayload} from '../../app/utils/program-templates';
import {TrainingsPlanExportPayload} from '../../app/utils/exportTrainingsPlan';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {selectAllExercises} from '../../app/redux/Exercises/use/useAllExercises';
import {selectAllTimeOneRepMaxLookup} from '../../app/redux/Workout/use/useAllTimeOneRepMax';

/** The actions this spec dispatches, shaped like the app's dispatch helpers send them. */
type PlanAction =
  | {type: 'FULL_IMPORT'; state: GlobalState}
  | {type: 'ADD_TRAININGS_PLAN'; trainingsPlan: Pick<TrainingsPlan, 'name'>}
  | {type: 'IMPORT_TRAININGS_PLAN'; payload: TrainingsPlanExportPayload; planId?: number}
  | {type: 'SET_CURRENT_TRAININGS_PLAN'; trainingsPlanId: number | undefined}
  | {type: 'DELETE_TRAININGS_PLAN'; trainingsPlanId: number}
  | {type: 'EDIT_TRAININGS_PLAN'; trainingsPlanId: number; name: string};

const reduce = (state: GlobalState, action: PlanAction): GlobalState => rootReducer(state, action);

// The store's initial state, slice by slice: reduce-reducers types rootReducer's state as required,
// so it cannot be asked for its initial state directly.
const init = {type: '@@INIT'};
const freshInstall = (): GlobalState => ({
  exercises: exerciseReducer(undefined, init),
  workouts: workoutReducer(undefined, init),
  trainingsPlan: trainingsPlanReducer(undefined, init),
  trainings: trainingsReducer(undefined, init),
  videoAnalyses: videoAnalysisReducer(undefined, init),
  bodyWeight: bodyWeightReducer(undefined, init),
  settings: settingsReducer(undefined, init),
  effects: effectsReducer(undefined, init),
  aiChat: aiChatReducer(undefined, init),
});

const baseline = (): GlobalState => {
  // `_persist` is redux-persist's bookkeeping; the app's persistReducer strips it before rootReducer sees the state.
  const {_persist, ...fixture}: GlobalState & {_persist?: unknown} = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../testdata/1772318214222.gains'), 'utf8'),
  );
  return reduce(freshInstall(), {type: 'FULL_IMPORT', state: fixture});
};

const addPlan = (state: GlobalState, name: string) => reduce(state, {type: 'ADD_TRAININGS_PLAN', trainingsPlan: {name}});

/** What ADD_TRAININGS_PLAN stores for a new empty plan (it sets no `trainingNames`). */
const emptyPlan = (id: number, name: string): Omit<TrainingsPlan, 'trainingNames'> & {id: number} => ({
  name,
  id,
  trainings: {},
  mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
});

/** `state` with `plan` appended as the newest plan. */
const withPlan = (state: GlobalState, plan: ReturnType<typeof emptyPlan>) => ({
  ...state.trainingsPlan,
  byId: {...state.trainingsPlan.byId, [plan.id]: plan},
  allIds: [...state.trainingsPlan.allIds, plan.id],
});

describe('the current trainings plan (GH-518)', () => {
  it('is not set on a fresh install or by importing a backup without one (no migration)', () => {
    const fresh = freshInstall();
    const imported = baseline();

    expect(fresh.settings).not.toHaveProperty('currentTrainingsPlanId');
    expect(imported.settings).not.toHaveProperty('currentTrainingsPlanId');
  });

  it('makes the first plan of an empty app the current plan', () => {
    const before = freshInstall();
    const after = addPlan(before, 'Kraftblock');

    expect(after).toEqual({
      ...before,
      trainingsPlan: withPlan(before, emptyPlan(1, 'Kraftblock')),
      settings: {...before.settings, currentTrainingsPlanId: 1},
    });
  });

  it('makes a newly created plan the current one when other plans exist', () => {
    const before = baseline();
    const newId = Math.max(...before.trainingsPlan.allIds) + 1;
    const after = addPlan(before, 'Kraftblock');

    expect(after).toEqual({
      ...before,
      trainingsPlan: withPlan(before, emptyPlan(newId, 'Kraftblock')),
      settings: {...before.settings, currentTrainingsPlanId: newId},
    });
  });

  it('makes a plan created from a template or a plan file the current one', () => {
    const before = baseline();
    const template = PROGRAM_TEMPLATES.find((t) => t.id === 'strength-block')!;
    const payload = buildTemplatePlanPayload(template, {
      existingExercises: selectAllExercises(before),
      oneRepMaxFor: selectAllTimeOneRepMaxLookup(before),
    });

    // The id mapping of the imported entities is covered in fullStateReducer.test.ts; here every
    // other slice must stay as it was and settings may only gain the current plan.
    const expectImportedAsCurrent = (after: GlobalState, newId: number) => {
      expect(after.trainingsPlan.allIds).toEqual([...before.trainingsPlan.allIds, newId]);
      expect(after.trainingsPlan.byId[newId].name).toBe(template.name);
      expect(after).toEqual({
        ...before,
        exercises: after.exercises,
        workouts: after.workouts,
        trainings: after.trainings,
        trainingsPlan: after.trainingsPlan,
        settings: {...before.settings, currentTrainingsPlanId: newId},
      });
    };

    expectImportedAsCurrent(reduce(before, {type: 'IMPORT_TRAININGS_PLAN', payload}), Math.max(...before.trainingsPlan.allIds) + 1);
    expectImportedAsCurrent(reduce(before, {type: 'IMPORT_TRAININGS_PLAN', payload, planId: 42}), 42);
  });

  it('switches with the star and leaves everything else untouched', () => {
    const before = addPlan(addPlan(freshInstall(), 'A'), 'B');
    const after = reduce(before, {type: 'SET_CURRENT_TRAININGS_PLAN', trainingsPlanId: 1});

    expect(before.settings.currentTrainingsPlanId).toBe(2);
    expect(after).toEqual({...before, settings: {...before.settings, currentTrainingsPlanId: 1}});
  });

  it('is cleared when the current plan is deleted, and kept when another plan is deleted', () => {
    const state = addPlan(addPlan(freshInstall(), 'A'), 'B');
    const planA = emptyPlan(1, 'A');
    const planB = emptyPlan(2, 'B');

    expect(reduce(state, {type: 'DELETE_TRAININGS_PLAN', trainingsPlanId: 1})).toEqual({
      ...state,
      trainingsPlan: {...state.trainingsPlan, byId: {2: planB}, allIds: [2]},
    });
    expect(reduce(state, {type: 'DELETE_TRAININGS_PLAN', trainingsPlanId: 2})).toEqual({
      ...state,
      trainingsPlan: {...state.trainingsPlan, byId: {1: planA}, allIds: [1]},
      settings: {...state.settings, currentTrainingsPlanId: undefined},
    });
  });

  it('does not change on renaming a plan', () => {
    const state = addPlan(addPlan(freshInstall(), 'A'), 'B');

    expect(reduce(state, {type: 'EDIT_TRAININGS_PLAN', trainingsPlanId: 1, name: 'A2'})).toEqual({
      ...state,
      trainingsPlan: {...state.trainingsPlan, byId: {1: emptyPlan(1, 'A2'), 2: emptyPlan(2, 'B')}},
    });
  });
});
