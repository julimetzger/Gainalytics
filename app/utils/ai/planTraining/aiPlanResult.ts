/**
 * GH-544 — reads the model's answer for "Plan with AI" and checks it for STRUCTURE only:
 * valid JSON in the schema, known exercise ids, numbers that are numbers (reps > 0,
 * weight >= 0, RIR 0–10 or an app range). There are no content limits. Parts that cannot
 * be used are dropped and named; without anything usable left the answer is an error.
 */
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {RIR_MAX, RIR_MIN} from '../../rirInput';
import {PlanRangeField, withPlanRangeMax} from '../../planRange';

export interface AiPlanExercise {
  exerciseId: number;
  sets: WorkoutSet[];
}

export interface AiPlan {
  explanation: string;
  /** Exercises the user asked for that do not exist, as named by the model. */
  notFound: string[];
  exercises: AiPlanExercise[];
  /** Readable descriptions of the parts that were dropped by the validator. */
  dropped: string[];
}

export type AiPlanParseResult = {ok: true; plan: AiPlan} | {ok: false; error: string; dropped: string[]};

const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const SINGLE_VALUE = new RegExp(`^${NUMBER}$`);
const RANGE_VALUE = new RegExp(`^${NUMBER}\\s*[-–]\\s*${NUMBER}$`);

const toNumber = (text: string) => Number(text.replace(',', '.'));

type Bounds = {min: number; max?: number};

function readBounds(raw: unknown): Bounds | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? {min: raw} : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  const single = SINGLE_VALUE.exec(text);
  if (single) return {min: toNumber(single[1])};
  const range = RANGE_VALUE.exec(text);
  if (!range) return undefined;
  const min = toNumber(range[1]);
  const max = toNumber(range[2]);
  if (max < min) return undefined;
  return max === min ? {min} : {min, max};
}

const FIELD_RULES: Record<PlanRangeField, {check: (value: number) => boolean; rule: string}> = {
  reps: {check: value => value > 0, rule: 'reps must be a number above 0'},
  weight: {check: value => value >= 0, rule: 'weight must be a number of at least 0'},
  rir: {check: value => value >= RIR_MIN && value <= RIR_MAX, rule: `RIR must be a number from ${RIR_MIN} to ${RIR_MAX}`},
};

/** RIR keeps two decimals, like a typed RIR (parseRirInput). */
const normalize = (field: PlanRangeField, value: number) => (field === 'rir' ? Math.round(value * 100) / 100 : value);

function readSet(raw: unknown, index: number): {set: WorkoutSet} | {error: string} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {error: 'not an object'};
  }
  const values = raw as Record<string, unknown>;
  let workoutSet: WorkoutSet = {index, reps: 0, weight: 0, rir: 0};
  const maxima: Partial<Record<PlanRangeField, number>> = {};
  for (const field of ['reps', 'weight', 'rir'] as const) {
    const bounds = readBounds(values[field]);
    const {check, rule} = FIELD_RULES[field];
    if (bounds === undefined || !check(bounds.min) || (bounds.max !== undefined && !check(bounds.max))) {
      return {error: rule};
    }
    workoutSet = {...workoutSet, [field]: normalize(field, bounds.min)};
    if (bounds.max !== undefined) maxima[field] = normalize(field, bounds.max);
  }
  for (const field of ['reps', 'weight', 'rir'] as const) {
    workoutSet = withPlanRangeMax(workoutSet, field, maxima[field]);
  }
  return {set: workoutSet};
}

/** The JSON object of the answer: the whole text, a fenced block, or the outermost braces. */
function extractJson(text: string): unknown {
  const candidates = [text.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

export function parseAiPlanAnswer(text: string, exercises: Exercise[]): AiPlanParseResult {
  const json = extractJson(text);
  if (json === undefined || json === null || typeof json !== 'object' || Array.isArray(json)) {
    return {ok: false, error: 'The AI answer contained no readable plan (no valid JSON).', dropped: []};
  }
  const root = json as Record<string, unknown>;
  if (!Array.isArray(root.exercises)) {
    return {ok: false, error: 'The AI answer does not match the plan format (no "exercises" list).', dropped: []};
  }

  const namesById = new Map(
    exercises.filter(exercise => exercise.id !== undefined).map(exercise => [exercise.id!, exercise.name] as const),
  );
  const dropped: string[] = [];
  const planned: AiPlanExercise[] = [];

  root.exercises.forEach((raw, position) => {
    const entry = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const id = entry.exercise_id;
    const answerName = typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : undefined;
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      dropped.push(`${answerName ?? `Exercise ${position + 1}`}: no valid exercise id`);
      return;
    }
    const name = namesById.get(id);
    if (name === undefined) {
      dropped.push(`${answerName ?? `Exercise #${id}`}: not found in your exercises`);
      return;
    }
    if (planned.some(exercise => exercise.exerciseId === id)) {
      dropped.push(`${name}: listed twice`);
      return;
    }
    if (!Array.isArray(entry.sets)) {
      dropped.push(`${name}: no sets`);
      return;
    }
    const sets: WorkoutSet[] = [];
    entry.sets.forEach((rawSet, setPosition) => {
      const result = readSet(rawSet, sets.length + 1);
      if ('error' in result) {
        dropped.push(`${name} set ${setPosition + 1}: ${result.error}`);
      } else {
        sets.push(result.set);
      }
    });
    if (sets.length === 0) {
      dropped.push(`${name}: no usable sets`);
      return;
    }
    planned.push({exerciseId: id, sets});
  });

  if (planned.length === 0) {
    return {ok: false, error: 'The AI answer contained no usable exercises.', dropped};
  }
  const notFound = Array.isArray(root.not_found)
    ? root.not_found.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
    : [];
  return {
    ok: true,
    plan: {
      explanation: typeof root.explanation === 'string' ? root.explanation.trim() : '',
      notFound,
      exercises: planned,
      dropped,
    },
  };
}

/** The lines shown after planning: the explanation, missing exercises and dropped parts. */
export function describeAiPlan(plan: AiPlan): string {
  return [
    plan.explanation,
    ...plan.notFound.map(name => `${name} not found in your exercises.`),
    ...(plan.dropped.length > 0 ? [`Ignored: ${plan.dropped.join('; ')}.`] : []),
  ]
    .filter(line => line !== '')
    .join('\n');
}
