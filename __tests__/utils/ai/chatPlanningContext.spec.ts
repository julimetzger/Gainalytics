import {
  buildPlannedTrainingsContext,
  buildSelectedTrainingContext,
  buildTrainingLocators,
  currentMicroOf,
  listChatSelectableTrainings,
  plannedFieldValue,
  selectActivePlan,
} from '../../../app/utils/ai/chatPlanningContext';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../app/models/entities/WorkoutSet';
import {Exercise} from '../../../app/models/entities/Exercise';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';

const set = (reps: number, weight: number, rir: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  reps,
  weight,
  rir,
  ...extra,
});

const workout = (id: number, exerciseId: number, sets: WorkoutSet[]): Workout => ({id, exerciseId, sets});

const exercise = (id: number, name: string): Exercise => ({id, name});

const training = (id: number, state: TrainingsState, over: Partial<Training> = {}): Training => ({
  id,
  state,
  exercises: [],
  plannedWorkouts: {},
  doneWorkoutIds: {},
  ...over,
});

/**
 * A plan with two mesos: micros 1-2 in "Base", micros 3+ in "Peak".
 * Micro 1 is fully trained, micro 2 holds the planned sessions, micro 3 is the
 * next micro, micro 4 must never appear (out of scope).
 */
function makeFixture() {
  const exercisesById: Record<number, Exercise> = {
    10: exercise(10, 'Squat'),
    11: exercise(11, 'Bench Press'),
    12: exercise(12, 'Deadlift'),
  };

  const workoutsById: Record<number, Workout> = {
    // micro 1 — done
    100: workout(100, 10, [set(5, 100, 2), set(5, 100, 1)]),
    // micro 1 — what had been planned for it
    101: workout(101, 10, [set(5, 100, 2), set(5, 102.5, 2)]),
    // micro 2 position 1 — planned, with a rep AND rir range
    200: workout(200, 10, [set(8, 110, 1, {repsMax: 12, rirMax: 3}), set(8, 110, 1, {repsMax: 12, rirMax: 3})]),
    201: workout(201, 11, [set(5, 80, 2)]),
    // micro 2 position 2 — planned, fixed values only
    210: workout(210, 12, [set(3, 150, 1)]),
    // micro 3 — next micro
    300: workout(300, 10, [set(6, 115, 1, {weightMax: 120})]),
    // micro 4 — out of scope; 999 kg is the marker that must never leak
    400: workout(400, 10, [set(6, 999, 1)]),
  };

  const trainingsById: Record<number, Training> = {
    1: training(1, TrainingsState.FINISHED, {
      end: new Date('2026-03-01T18:00:00.000Z'),
      start: new Date('2026-03-01T17:00:00.000Z'),
      doneWorkoutIds: {10: 100},
      plannedWorkouts: {10: 101},
    }),
    2: training(2, TrainingsState.PLANNED, {plannedWorkouts: {10: 200, 11: 201}}),
    3: training(3, TrainingsState.PLANNED, {plannedWorkouts: {12: 210}}),
    4: training(4, TrainingsState.PLANNED, {plannedWorkouts: {10: 300}}),
    5: training(5, TrainingsState.PLANNED, {plannedWorkouts: {10: 400}}),
  };

  const plan: TrainingsPlan = {
    id: 1,
    name: 'Push pull',
    trainings: {'1,1': 1, '2,1': 2, '2,2': 3, '3,1': 4, '4,1': 5},
    trainingNames: {1: 'Push', 2: 'Pull'},
    mesos: [
      {id: 1, name: 'Base', order: 1, startMicro: 1},
      {id: 2, name: 'Peak', order: 2, startMicro: 3},
    ],
  };

  return {plan, plans: [plan], trainingsById, workoutsById, exercisesById};
}

describe('plannedFieldValue', () => {
  it('keeps a fixed value a plain number', () => {
    expect(plannedFieldValue(set(8, 100, 1), 'reps')).toBe(8);
    expect(plannedFieldValue(set(8, 100, 1), 'weight')).toBe(100);
  });

  it('renders a planned range as a range, never as its lower bound', () => {
    const ranged = set(8, 100, 1, {repsMax: 12, rirMax: 3, weightMax: 110});
    expect(plannedFieldValue(ranged, 'reps')).toBe('8-12');
    expect(plannedFieldValue(ranged, 'rir')).toBe('1-3');
    expect(plannedFieldValue(ranged, 'weight')).toBe('100-110');
  });

  it('degrades an inverted or equal bound back to the fixed value', () => {
    expect(plannedFieldValue(set(8, 100, 1, {repsMax: 8}), 'reps')).toBe(8);
    expect(plannedFieldValue(set(8, 100, 1, {repsMax: 5}), 'reps')).toBe(8);
  });
});

describe('selectActivePlan / currentMicroOf', () => {
  it('picks the plan whose last finished training is the most recent', () => {
    const {plans, trainingsById} = makeFixture();
    const other: TrainingsPlan = {
      id: 2,
      name: 'Old plan',
      trainings: {'1,1': 90},
      trainingNames: {1: 'Legacy'},
    };
    const withOld = {
      ...trainingsById,
      90: training(90, TrainingsState.FINISHED, {end: new Date('2020-01-01T10:00:00.000Z')}),
    };
    expect(selectActivePlan([other, ...plans], withOld)?.name).toBe('Push pull');
  });

  it('prefers a plan with a running session over a more recently finished one', () => {
    const {plan, trainingsById} = makeFixture();
    const running: TrainingsPlan = {
      id: 2,
      name: 'Running plan',
      trainings: {'1,1': 90},
      trainingNames: {1: 'Legacy'},
    };
    const withRunning = {...trainingsById, 90: training(90, TrainingsState.STARTED)};
    expect(selectActivePlan([plan, running], withRunning)?.name).toBe('Running plan');
  });

  it('falls back to a plan that has never been trained', () => {
    const fresh: TrainingsPlan = {id: 9, name: 'Brand new', trainings: {'1,1': 1}, trainingNames: {1: 'Push'}};
    const trainingsById = {1: training(1, TrainingsState.PLANNED, {plannedWorkouts: {10: 100}})};
    expect(selectActivePlan([fresh], trainingsById)?.name).toBe('Brand new');
    expect(currentMicroOf(fresh, trainingsById)).toBe(1);
  });

  it('reports the first micro that still has an untrained slot', () => {
    const {plan, trainingsById} = makeFixture();
    expect(currentMicroOf(plan, trainingsById)).toBe(2);
  });

  it('reports the micro of a running session', () => {
    const {plan, trainingsById} = makeFixture();
    const withRunning = {...trainingsById, 4: training(4, TrainingsState.STARTED, {plannedWorkouts: {10: 300}})};
    expect(currentMicroOf(plan, withRunning)).toBe(3);
  });
});

/**
 * GH-391 review, misbehaviour 1: a user who creates a new plan and has not
 * trained a single session from it saw no planned trainings in the chat at all,
 * because any older plan with finished sessions won on recency.
 */
describe('selectActivePlan with an old and a newly created plan', () => {
  const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();
  const daysBeforeNow = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000);

  /**
   * "Old block" (id 1) has been trained; "New block" (id 2) has never been
   * touched. `oldPlanLeftovers` decides whether the old plan is fully trained or
   * still has an untrained slot, `oldPlanLastTrainedDaysAgo` how long ago the
   * user last trained in it.
   */
  function twoPlans(options: {oldPlanLeftovers: boolean; oldPlanLastTrainedDaysAgo: number}) {
    const exercisesById: Record<number, Exercise> = {
      10: exercise(10, 'Squat'),
      11: exercise(11, 'Deadlift'),
      12: exercise(12, 'Bench Press'),
    };
    const workoutsById: Record<number, Workout> = {
      // old plan — only ever Bench Press, so its content is recognisable
      500: workout(500, 12, [set(5, 60, 2)]),
      501: workout(501, 12, [set(5, 62.5, 2)]),
      // new plan — micro 1 with a planned range, micro 2 with fixed values
      600: workout(600, 11, [set(3, 140, 1, {repsMax: 5})]),
      601: workout(601, 10, [set(8, 90, 2)]),
    };
    const lastEnd = daysBeforeNow(options.oldPlanLastTrainedDaysAgo);
    const trainingsById: Record<number, Training> = {
      50: training(50, TrainingsState.FINISHED, {
        end: lastEnd,
        start: lastEnd,
        doneWorkoutIds: {12: 500},
        plannedWorkouts: {12: 500},
      }),
      51: options.oldPlanLeftovers
        ? training(51, TrainingsState.PLANNED, {plannedWorkouts: {12: 501}})
        : training(51, TrainingsState.FINISHED, {
            end: lastEnd,
            start: lastEnd,
            doneWorkoutIds: {12: 501},
            plannedWorkouts: {12: 501},
          }),
      60: training(60, TrainingsState.PLANNED, {plannedWorkouts: {11: 600}}),
      61: training(61, TrainingsState.PLANNED, {plannedWorkouts: {10: 601}}),
    };
    const oldPlan: TrainingsPlan = {
      id: 1,
      name: 'Old block',
      trainings: {'1,1': 50, '1,2': 51},
      trainingNames: {1: 'Bench day', 2: 'Bench day 2'},
    };
    const newPlan: TrainingsPlan = {
      id: 2,
      name: 'New block',
      trainings: {'1,1': 60, '2,1': 61},
      trainingNames: {1: 'Deadlift day'},
    };
    return {plans: [oldPlan, newPlan], oldPlan, newPlan, trainingsById, workoutsById, exercisesById};
  }

  it('picks the untouched new plan over a fully trained old one', () => {
    const {plans, trainingsById} = twoPlans({oldPlanLeftovers: false, oldPlanLastTrainedDaysAgo: 1});
    expect(selectActivePlan(plans, trainingsById, NOW)?.name).toBe('New block');
  });

  it('puts the new plan’s sessions into the context, with their ranges', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = twoPlans({
      oldPlanLeftovers: false,
      oldPlanLastTrainedDaysAgo: 1,
    });
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById, NOW)!;

    expect(context.plan_name).toBe('New block');
    expect(context.current_micro).toBe(1);
    // current micro and the next one, both from the plan that was never trained
    expect(context.sessions.map(s => s.micro)).toEqual([1, 2]);
    expect(context.sessions[0].name).toBe('Deadlift day');
    expect(context.sessions[0].exercises[0]).toEqual({
      name: 'Deadlift',
      sets: [{reps: '3-5', weight_kg: 140, rir: 1}],
    });
    // the old plan is done — nothing of it may show up as "planned"
    expect(JSON.stringify(context)).not.toContain('Bench Press');
  });

  it('offers the new plan’s trainings in the picker', () => {
    const {plans, trainingsById} = twoPlans({oldPlanLeftovers: false, oldPlanLastTrainedDaysAgo: 1});
    const selectable = listChatSelectableTrainings(plans, trainingsById, 15, NOW);

    expect(selectable.filter(t => t.state === 'planned').map(t => t.id)).toEqual([60, 61]);
    // the finished sessions of the old plan stay selectable as before
    expect(selectable.filter(t => t.state === 'finished').map(t => t.id).sort()).toEqual([50, 51]);
  });

  it('keeps a plan the user is still training in ahead of a fresh draft', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = twoPlans({
      oldPlanLeftovers: true,
      oldPlanLastTrainedDaysAgo: 3,
    });
    expect(selectActivePlan(plans, trainingsById, NOW)?.name).toBe('Old block');
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById, NOW)!;
    expect(context.plan_name).toBe('Old block');
    expect(context.sessions[0].exercises[0].name).toBe('Bench Press');
  });

  it('moves on to the newer plan once the old one has gone stale', () => {
    const {plans, trainingsById} = twoPlans({oldPlanLeftovers: true, oldPlanLastTrainedDaysAgo: 120});
    expect(selectActivePlan(plans, trainingsById, NOW)?.name).toBe('New block');
  });

  it('a running session wins over everything, even in the older plan', () => {
    const {plans, trainingsById} = twoPlans({oldPlanLeftovers: true, oldPlanLastTrainedDaysAgo: 120});
    const withRunning = {...trainingsById, 51: training(51, TrainingsState.STARTED, {plannedWorkouts: {12: 501}})};
    expect(selectActivePlan(plans, withRunning, NOW)?.name).toBe('Old block');
  });

  it('has no active plan when every plan is fully trained', () => {
    const {oldPlan, trainingsById} = twoPlans({oldPlanLeftovers: false, oldPlanLastTrainedDaysAgo: 1});
    expect(selectActivePlan([oldPlan], trainingsById, NOW)).toBeUndefined();
  });
});

describe('buildPlannedTrainingsContext', () => {
  it('carries meso, micro, position, name, exercises and planned sets', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;

    expect(context.plan_name).toBe('Push pull');
    expect(context.current_micro).toBe(2);

    const first = context.sessions[0];
    expect(first).toMatchObject({
      micro: 2,
      micro_in_meso: 2,
      meso_name: 'Base',
      position: 1,
      name: 'Push',
      state: 'planned',
    });
    expect(first.exercises.map(e => e.name)).toEqual(['Squat', 'Bench Press']);
    expect(first.exercises[1].sets).toEqual([{reps: 5, weight_kg: 80, rir: 2}]);
  });

  it('passes planned ranges through as ranges', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;

    expect(context.sessions[0].exercises[0].sets[0]).toEqual({reps: '8-12', weight_kg: 110, rir: '1-3'});
    // and the serialised form the model sees actually contains the range
    expect(JSON.stringify(context)).toContain('"reps":"8-12"');
    expect(JSON.stringify(context)).not.toContain('"reps":8,');
  });

  it('is bounded to the current and the next micro', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;

    expect(context.sessions.map(s => s.micro)).toEqual([2, 2, 3]);
    expect(context.scope).toBe('current micro 2 and next micro 3');
    // micro 4 exists in the plan and must not leak into the prompt
    expect(JSON.stringify(context)).not.toContain('999');
  });

  it('names the meso of the NEXT micro correctly when it starts a new meso', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const context = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;
    const nextMicro = context.sessions.find(s => s.micro === 3)!;
    expect(nextMicro.meso_name).toBe('Peak');
    expect(nextMicro.micro_in_meso).toBe(1);
  });

  it('returns null when nothing is planned at all', () => {
    const plan: TrainingsPlan = {
      id: 1,
      name: 'Push pull',
      trainings: {'1,1': 1},
      trainingNames: {1: 'Push'},
    };
    const trainingsById = {
      1: training(1, TrainingsState.FINISHED, {end: new Date('2026-03-01T18:00:00.000Z'), doneWorkoutIds: {10: 100}}),
    };
    const result = buildPlannedTrainingsContext(
      [plan],
      trainingsById,
      {100: workout(100, 10, [set(5, 100, 2)])},
      {10: exercise(10, 'Squat')},
    );
    expect(result).toBeNull();
  });

  it('returns null when there are no plans at all', () => {
    expect(buildPlannedTrainingsContext([], {}, {}, {})).toBeNull();
  });

  it('drops empty placeholder slots instead of inventing sessions', () => {
    const plan: TrainingsPlan = {
      id: 1,
      name: 'Push pull',
      trainings: {'1,1': 1, '1,2': 2},
      trainingNames: {1: 'Push', 2: 'Pull'},
    };
    const trainingsById = {
      1: training(1, TrainingsState.PLANNED, {plannedWorkouts: {10: 100}}),
      // slot with no planned workout at all — a placeholder, not a session
      2: training(2, TrainingsState.PLANNED),
    };
    const context = buildPlannedTrainingsContext(
      [plan],
      trainingsById,
      {100: workout(100, 10, [set(5, 100, 2)])},
      {10: exercise(10, 'Squat')},
    )!;
    expect(context.sessions).toHaveLength(1);
    expect(context.sessions[0].name).toBe('Push');
  });

  it('drops an exercise whose planned workout has no sets', () => {
    const plan: TrainingsPlan = {
      id: 1,
      name: 'Push pull',
      trainings: {'1,1': 1},
      trainingNames: {1: 'Push'},
    };
    const trainingsById = {1: training(1, TrainingsState.PLANNED, {plannedWorkouts: {10: 100, 11: 101}})};
    const context = buildPlannedTrainingsContext(
      [plan],
      trainingsById,
      {100: workout(100, 10, [set(5, 100, 2)]), 101: workout(101, 11, [])},
      {10: exercise(10, 'Squat'), 11: exercise(11, 'Bench Press')},
    )!;
    expect(context.sessions[0].exercises.map(e => e.name)).toEqual(['Squat']);
  });
});

describe('buildSelectedTrainingContext', () => {
  const videoAnalyses: Record<number, VideoAnalysis> = {};

  it('gives a planned training its plan, but no performed block', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const locators = buildTrainingLocators(plans, trainingsById);
    const context = buildSelectedTrainingContext(2, trainingsById, workoutsById, exercisesById, videoAnalyses, locators)!;

    expect(context).toMatchObject({
      training_id: 2,
      name: 'Push',
      plan_name: 'Push pull',
      meso_name: 'Base',
      micro: 2,
      micro_in_meso: 2,
      position: 1,
      state: 'planned',
    });
    expect(context.planned[0].sets[0]).toEqual({reps: '8-12', weight_kg: 110, rir: '1-3'});
    expect(context.performed).toBeUndefined();
  });

  it('gives a finished training BOTH the plan and what was actually done', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const locators = buildTrainingLocators(plans, trainingsById);
    const context = buildSelectedTrainingContext(1, trainingsById, workoutsById, exercisesById, videoAnalyses, locators)!;

    expect(context.state).toBe('finished');
    expect(context.date).toBe('2026-03-01');
    expect(context.planned).toEqual([
      {name: 'Squat', sets: [{reps: 5, weight_kg: 100, rir: 2}, {reps: 5, weight_kg: 102.5, rir: 2}]},
    ]);
    expect(context.performed).toEqual([
      {name: 'Squat', sets: [{reps: 5, weight_kg: 100, rir: 2}, {reps: 5, weight_kg: 100, rir: 1}]},
    ]);
  });

  it('attaches the measured velocity loss to a performed set', () => {
    const {plans, trainingsById, workoutsById, exercisesById} = makeFixture();
    const locators = buildTrainingLocators(plans, trainingsById);
    const analyses: Record<number, VideoAnalysis> = {
      1: {
        id: 1,
        status: VideoAnalysisStatus.DONE,
        workoutId: 100,
        setIndex: 1,
        setResult: {velocityLossPercent: 23.4},
      } as unknown as VideoAnalysis,
    };
    const context = buildSelectedTrainingContext(1, trainingsById, workoutsById, exercisesById, analyses, locators)!;
    expect(context.performed![0].sets[1].vl_percent).toBe(23);
  });

  it('returns null for a training that has neither plan nor performed sets', () => {
    const trainingsById = {7: training(7, TrainingsState.PLANNED)};
    const context = buildSelectedTrainingContext(7, trainingsById, {}, {}, videoAnalyses, new Map());
    expect(context).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(buildSelectedTrainingContext(999, {}, {}, {}, videoAnalyses, new Map())).toBeNull();
  });
});

describe('listChatSelectableTrainings', () => {
  it('offers the planned sessions in scope first, then the recent finished ones', () => {
    const {plans, trainingsById} = makeFixture();
    const list = listChatSelectableTrainings(plans, trainingsById);

    expect(list.map(t => t.id)).toEqual([2, 3, 4, 1]);
    expect(list[0]).toMatchObject({label: 'Micro 2 · Push', state: 'planned'});
    expect(list[3]).toMatchObject({label: 'Micro 1 · Push', state: 'finished', date: '2026-03-01'});
  });

  it('caps the finished list', () => {
    const plan: TrainingsPlan = {id: 1, name: 'P', trainings: {}, trainingNames: {}};
    const trainingsById: Record<number, Training> = {};
    for (let i = 1; i <= 30; i++) {
      trainingsById[i] = training(i, TrainingsState.FINISHED, {end: new Date(2026, 0, i)});
      plan.trainings[`${i},1`] = i;
    }
    expect(listChatSelectableTrainings([plan], trainingsById, 5)).toHaveLength(5);
  });

  it('is empty when there is nothing at all', () => {
    expect(listChatSelectableTrainings([], {})).toEqual([]);
  });
});
