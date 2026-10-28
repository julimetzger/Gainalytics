import fs from 'fs';
import path from 'path';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {buildAiPlanAction} from '../../../app/redux/Training/dispatch/plan/usePlanFromAi';
import {getPreviousTrainingsForTrainingInMeso} from '../../../app/redux/Training/trainingsPlanReducer';
import {determineNewId} from '../../../app/redux/normalizedState';
import {determineNewWorkoutId} from '../../../app/redux/normalizedWorkoutState';
import {buildAiPlanBase} from '../../../app/utils/ai/planTraining/aiPlanContext';
import {parseAiPlanAnswer} from '../../../app/utils/ai/planTraining/aiPlanResult';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Exercise} from '../../../app/models/entities/Exercise';

/**
 * GH-544: the AI result is planned through the real reducers on the real baseline store —
 * plan "Push pull" (id 5), next slot Meso 1 · M6 · D1, base = the finished M5 D1 (training 378).
 */
function baselineState(): GlobalState {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../e2e/maestro/fixtures/baseline.gains'), 'utf8'));
  // redux-persist's bookkeeping key is not a slice; combineReducers would warn about it.
  const imported = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== '_persist'));
  return rootReducer(rootReducer(undefined, {type: '@@INIT'}), {type: 'FULL_IMPORT', state: imported});
}

const SLOT = {trainingsPlanId: 5, microNumber: 6, trainingInMicroNumber: 1};

// Base: Squat 2 sets (5@170 RIR 1, 8@150 RIR 2), Bankdrücken (id 1), Leg curl 1 set (12@95 RIR 1).
const ANSWER = JSON.stringify({
  explanation: 'RIR -1, Paused bench press instead of Bankdrücken, one set less on Squat, one more on Leg curl.',
  not_found: [],
  exercises: [
    {exercise_id: 2, name: 'Squat', sets: [{reps: 5, weight: 170, rir: 0}]},
    {exercise_id: 5, name: 'Paused bench press', sets: [{reps: 6, weight: 110, rir: 2}, {reps: 11, weight: 100, rir: 0}]},
    {exercise_id: 9, name: 'Leg curl', sets: [{reps: 12, weight: 95, rir: 0}, {reps: '10-12', weight: 95, rir: 0}]},
  ],
});

describe('planning an AI result (GH-544)', () => {
  it('plans the training exactly as returned: swapped exercise, removed and added sets', () => {
    const state = baselineState();
    const plan = state.trainingsPlan.byId[SLOT.trainingsPlanId];
    const previous = getPreviousTrainingsForTrainingInMeso(plan.trainings, SLOT.trainingInMicroNumber, SLOT.microNumber, plan.mesos);
    const baseTraining = state.trainings.byId[previous[previous.length - 1]];
    const base = buildAiPlanBase(baseTraining, state.workouts.byId);
    expect(base.find(exercise => exercise.exerciseId === 2)?.sets).toEqual([
      {index: 1, reps: 5, rir: 1, weight: 170, date: expect.anything()},
      {index: 2, reps: 8, rir: 2, weight: 150, date: expect.anything()},
    ]);

    const parsed = parseAiPlanAnswer(ANSWER, Object.values(state.exercises.byId) as Exercise[]);
    if (!parsed.ok) throw new Error(parsed.error);
    const nextTrainingsId = determineNewId(state.trainings);
    const nextWorkoutId = determineNewWorkoutId(state.workouts);

    const next = rootReducer(
      state,
      buildAiPlanAction(SLOT, baseTraining, parsed.plan.exercises, nextTrainingsId, nextWorkoutId),
    );

    expect(next.trainingsPlan.byId[5].trainings['6,1']).toBe(nextTrainingsId);
    expect(next.trainings.byId[nextTrainingsId]).toEqual({
      id: nextTrainingsId,
      state: TrainingsState.PLANNED,
      doneWorkoutIds: {},
      plannedWorkouts: {2: nextWorkoutId, 5: nextWorkoutId + 1, 9: nextWorkoutId + 2},
      exercises: [2, 5, 9],
    });
    const plannedWorkouts = [nextWorkoutId, nextWorkoutId + 1, nextWorkoutId + 2].map(id => next.workouts.byId[id]);
    const workoutFields = {notes: '', start: undefined, end: undefined, trainingsId: nextTrainingsId};
    expect(plannedWorkouts).toEqual([
      {...workoutFields, id: nextWorkoutId, exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 0, date: undefined}]},
      {
        ...workoutFields,
        id: nextWorkoutId + 1,
        exerciseId: 5,
        sets: [
          {index: 1, reps: 6, weight: 110, rir: 2, date: undefined},
          {index: 2, reps: 11, weight: 100, rir: 0, date: undefined},
        ],
      },
      {
        ...workoutFields,
        id: nextWorkoutId + 2,
        exerciseId: 9,
        sets: [
          {index: 1, reps: 12, weight: 95, rir: 0, date: undefined},
          {index: 2, reps: 10, repsMax: 12, weight: 95, rir: 0, date: undefined},
        ],
      },
    ]);
    // Only this training is touched: the base training stays as it was.
    expect(next.trainings.byId[baseTraining.id!]).toEqual(baseTraining);
  });
});
