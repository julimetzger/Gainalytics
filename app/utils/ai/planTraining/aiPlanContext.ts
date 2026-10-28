/**
 * GH-544 — "Plan with AI": what the model gets.
 *
 * The base is the training "Suggest based on last Training" would take: the last training at
 * this position, its logged sets when it was trained, otherwise its planned sets. The model
 * receives that base, the list of exercises it may use (id + name) and the user's free text,
 * and returns the complete planned training in the schema below.
 */
import {Exercise} from '../../../models/entities/Exercise';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {formatPlanFieldValue, getPlanRangeMax} from '../../planRange';
import {LlmTool} from '../../llmApi';

export interface AiPlanBaseExercise {
  exerciseId: number;
  sets: WorkoutSet[];
}

/** A fixed value as a number, a planned range as the app's "min-max" string. */
export type AiPlanValue = number | string;

export interface AiPlanContextSet {
  reps: AiPlanValue;
  weight: AiPlanValue;
  rir: AiPlanValue;
}

export interface AiPlanContext {
  base_training: {
    exercises: {exercise_id: number; name: string; sets: AiPlanContextSet[]}[];
  };
  available_exercises: {id: number; name: string; alternative_ids?: number[]}[];
  user_request: string;
}

export const AI_PLAN_TOOL_NAME = 'plan_training';

const VALUE_SCHEMA = {
  oneOf: [{type: 'number'}, {type: 'string', pattern: '^\\d+(\\.\\d+)?-\\d+(\\.\\d+)?$'}],
};

/** The fixed answer schema, shared by the prompt text and the Anthropic tool. */
export const AI_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    explanation: {type: 'string', description: 'One or two short sentences: what was changed.'},
    not_found: {
      type: 'array',
      items: {type: 'string'},
      description: 'Exercises the user asked for that are not in available_exercises.',
    },
    exercises: {
      type: 'array',
      description: 'The complete planned training, in order.',
      items: {
        type: 'object',
        properties: {
          exercise_id: {type: 'integer', description: 'An id from available_exercises.'},
          name: {type: 'string'},
          sets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {reps: VALUE_SCHEMA, weight: VALUE_SCHEMA, rir: VALUE_SCHEMA},
              required: ['reps', 'weight', 'rir'],
            },
          },
        },
        required: ['exercise_id', 'sets'],
      },
    },
  },
  required: ['explanation', 'exercises'],
} as const;

export const AI_PLAN_TOOL: LlmTool = {
  name: AI_PLAN_TOOL_NAME,
  description: "Plans today's training: the complete list of exercises with their sets.",
  input_schema: AI_PLAN_JSON_SCHEMA,
};

/**
 * The base training's exercises with their sets, in the training's order. Logged sets win
 * over planned ones, like "Suggest based on last Training" before its "planned" fallback.
 * Exercises without a workout are left out — there is nothing to repeat for them.
 */
export function buildAiPlanBase(
  training: Training | undefined,
  workoutsById: Record<number, Workout | undefined>,
): AiPlanBaseExercise[] {
  if (training === undefined) return [];
  const workoutIds =
    Object.keys(training.doneWorkoutIds ?? {}).length > 0 ? training.doneWorkoutIds : training.plannedWorkouts ?? {};
  const ordered = [
    ...training.exercises,
    ...Object.keys(workoutIds)
      .map(Number)
      .filter(exerciseId => !training.exercises.includes(exerciseId)),
  ];
  return ordered.flatMap(exerciseId => {
    const workout = workoutsById[workoutIds[exerciseId]];
    // Imported stores contain workouts without a sets array.
    if (!workout?.sets?.length) return [];
    const sets = [...workout.sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
    return [{exerciseId, sets}];
  });
}

const contextValue = (workoutSet: WorkoutSet, field: 'reps' | 'weight' | 'rir'): AiPlanValue =>
  getPlanRangeMax(workoutSet, field) === undefined ? workoutSet[field] : formatPlanFieldValue(workoutSet, field);

export function buildAiPlanContext(
  base: AiPlanBaseExercise[],
  exercises: Exercise[],
  userRequest: string,
): AiPlanContext {
  const nameOf = (exerciseId: number) => exercises.find(exercise => exercise.id === exerciseId)?.name ?? `Exercise ${exerciseId}`;
  return {
    base_training: {
      exercises: base.map(({exerciseId, sets}) => ({
        exercise_id: exerciseId,
        name: nameOf(exerciseId),
        sets: sets.map(workoutSet => ({
          reps: contextValue(workoutSet, 'reps'),
          weight: contextValue(workoutSet, 'weight'),
          rir: contextValue(workoutSet, 'rir'),
        })),
      })),
    },
    available_exercises: exercises
      .filter((exercise): exercise is Exercise & {id: number} => exercise.id !== undefined)
      .map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        ...(exercise.alternativeIds?.length ? {alternative_ids: exercise.alternativeIds} : {}),
      })),
    user_request: userRequest.trim(),
  };
}

export const AI_PLAN_SYSTEM_PROMPT = [
  "You plan today's gym training for an advanced athlete.",
  'You get the training they did last time at this position (base_training), every exercise they have (available_exercises) and their request in free text (user_request).',
  'Apply the requested changes to base_training and return the complete planned training. Keep everything the request does not mention exactly as in base_training.',
  'Allowed: changing reps, weight (kg) and RIR, adding and removing sets, reordering exercises, and swapping an exercise for another one from available_exercises (its alternative_ids are good candidates, but any listed exercise may be used).',
  'Never invent exercises: every exercise_id must come from available_exercises. If the user asks for an exercise that is not in the list, keep the original exercise unchanged and put the requested name into not_found.',
  'Values: numbers, or a range as a string "min-max" (e.g. "8-12") where base_training uses a range. reps > 0, weight >= 0, RIR from 0 to 10 (decimals like 1.5 are allowed).',
  'explanation: one or two short sentences saying what you changed.',
  `If the tool ${AI_PLAN_TOOL_NAME} is available, call it with the result. Otherwise answer with exactly one fenced \`\`\`json code block containing an object that matches this JSON schema:`,
  JSON.stringify(AI_PLAN_JSON_SCHEMA),
].join('\n');

export function buildAiPlanPrompt(context: AiPlanContext): {system: string; user: string} {
  return {system: AI_PLAN_SYSTEM_PROMPT, user: JSON.stringify(context)};
}
