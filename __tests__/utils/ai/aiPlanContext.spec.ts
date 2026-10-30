import {
  AI_PLAN_JSON_SCHEMA,
  AI_PLAN_SYSTEM_PROMPT,
  buildAiPlanBase,
  buildAiPlanContext,
  buildAiPlanPrompt,
} from '../../../app/utils/ai/planTraining/aiPlanContext';
import {Exercise} from '../../../app/models/entities/Exercise';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {TrainingsState} from '../../../app/models/TrainingsState';

const exercises = [
  {id: 1, name: 'Bench Press', alternativeIds: [3]},
  {id: 2, name: 'Squat'},
  {id: 3, name: 'Dumbbell Bench Press'},
] satisfies Exercise[];

const workoutsById: Record<number, Workout> = {
  10: {id: 10, exerciseId: 2, sets: [{index: 2, reps: 8, rir: 2, weight: 150}, {index: 1, reps: 5, rir: 1, weight: 170}]},
  11: {id: 11, exerciseId: 1, sets: [{index: 1, reps: 8, repsMax: 12, rir: 1, rirMax: 2, weight: 100}]},
  20: {id: 20, exerciseId: 2, sets: [{index: 1, reps: 3, rir: 0, weight: 200}]},
};

describe('buildAiPlanBase (GH-544)', () => {
  it('takes the logged sets in the order of the training, sorted by set index', () => {
    const training = {
      id: 5,
      exercises: [2, 1],
      doneWorkoutIds: {1: 11, 2: 10},
      plannedWorkouts: {2: 20},
      state: TrainingsState.FINISHED,
    } satisfies Training;

    expect(buildAiPlanBase(training, workoutsById)).toEqual([
      {exerciseId: 2, sets: [{index: 1, reps: 5, rir: 1, weight: 170}, {index: 2, reps: 8, rir: 2, weight: 150}]},
      {exerciseId: 1, sets: [{index: 1, reps: 8, repsMax: 12, rir: 1, rirMax: 2, weight: 100}]},
    ]);
  });

  it('falls back to the planned sets of a training that was not trained, and skips exercises without sets', () => {
    const training = {
      id: 6,
      exercises: [2, 3],
      doneWorkoutIds: {},
      plannedWorkouts: {2: 20},
      state: TrainingsState.PLANNED,
    } satisfies Training;

    expect(buildAiPlanBase(training, workoutsById)).toEqual([{exerciseId: 2, sets: [{index: 1, reps: 3, rir: 0, weight: 200}]}]);
  });

  it('is empty without a base training', () => {
    expect(buildAiPlanBase(undefined, workoutsById)).toEqual([]);
  });
});

describe('buildAiPlanContext / buildAiPlanPrompt (GH-544)', () => {
  const base = [
    {exerciseId: 2, sets: [{index: 1, reps: 5, rir: 1, weight: 170}]},
    {exerciseId: 1, sets: [{index: 1, reps: 8, repsMax: 12, rir: 1, rirMax: 2, weight: 100}]},
  ];

  it('sends the base training (ranges as app ranges), the exercise list and the user text', () => {
    expect(buildAiPlanContext(base, exercises, '  today dumbbell bench press instead of bench press ')).toEqual({
      base_training: {
        exercises: [
          {exercise_id: 2, name: 'Squat', sets: [{reps: 5, weight: 170, rir: 1}]},
          {exercise_id: 1, name: 'Bench Press', sets: [{reps: '8-12', weight: 100, rir: '1-2'}]},
        ],
      },
      available_exercises: [
        {id: 1, name: 'Bench Press', alternative_ids: [3]},
        {id: 2, name: 'Squat'},
        {id: 3, name: 'Dumbbell Bench Press'},
      ],
      user_request: 'today dumbbell bench press instead of bench press',
    });
  });

  it('puts the context into the user message and describes the schema in the system prompt', () => {
    const context = buildAiPlanContext(base, exercises, 'RIR -1 on everything');

    expect(buildAiPlanPrompt(context)).toEqual({system: AI_PLAN_SYSTEM_PROMPT, user: JSON.stringify(context)});
    expect(AI_PLAN_SYSTEM_PROMPT).toContain(JSON.stringify(AI_PLAN_JSON_SCHEMA));
    expect(AI_PLAN_SYSTEM_PROMPT).toContain('every exercise_id must come from available_exercises');
    expect(AI_PLAN_SYSTEM_PROMPT).toContain('```json');
  });
});
