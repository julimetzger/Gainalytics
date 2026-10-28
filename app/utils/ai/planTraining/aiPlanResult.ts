/**
 * GH-544 — reads the model's answer for "Plan with AI" and checks it for STRUCTURE only:
 * valid JSON in the schema, known exercise ids, numbers that are numbers (reps > 0,
 * weight >= 0, RIR a number or an app range, kept within 0–10). There are no content limits.
 * Parts that cannot be used are dropped and named; without anything usable left the answer
 * is an error.
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
  /** Exercises with an RIR outside 0–10 that was moved to the nearest bound. */
  rirClamped: string[];
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
  rir: {check: () => true, rule: 'RIR must be a number'},
};

const clampRir = (value: number) => Math.min(RIR_MAX, Math.max(RIR_MIN, value));

/** RIR keeps two decimals, like a typed RIR (parseRirInput). */
const normalize = (field: PlanRangeField, value: number) => (field === 'rir' ? Math.round(clampRir(value) * 100) / 100 : value);

/**
 * A numeric RIR outside 0–10 is moved to the nearest bound instead of dropping the set:
 * "RIR −1 on everything" on a set that is already at RIR 0 comes back as −1 from real
 * models, and dropping those sets removed whole exercises from the plan.
 */
const isRirOutOfRange = (bounds: Bounds) =>
  [bounds.min, bounds.max].some(value => value !== undefined && clampRir(value) !== value);

function readSet(raw: unknown, index: number): {set: WorkoutSet; rirClamped: boolean} | {error: string} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {error: 'not an object'};
  }
  const values = raw as Record<string, unknown>;
  let workoutSet: WorkoutSet = {index, reps: 0, weight: 0, rir: 0};
  const maxima: Partial<Record<PlanRangeField, number>> = {};
  let rirClamped = false;
  for (const field of ['reps', 'weight', 'rir'] as const) {
    const bounds = readBounds(values[field]);
    const {check, rule} = FIELD_RULES[field];
    if (bounds === undefined || !check(bounds.min) || (bounds.max !== undefined && !check(bounds.max))) {
      return {error: rule};
    }
    if (field === 'rir') rirClamped = isRirOutOfRange(bounds);
    const min = normalize(field, bounds.min);
    workoutSet = {...workoutSet, [field]: min};
    // A clamped range can collapse to one value (e.g. "11-12" → 10).
    if (bounds.max !== undefined && normalize(field, bounds.max) !== min) maxima[field] = normalize(field, bounds.max);
  }
  for (const field of ['reps', 'weight', 'rir'] as const) {
    workoutSet = withPlanRangeMax(workoutSet, field, maxima[field]);
  }
  return {set: workoutSet, rirClamped};
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
  const rirClamped: string[] = [];
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
    let clamped = false;
    entry.sets.forEach((rawSet, setPosition) => {
      const result = readSet(rawSet, sets.length + 1);
      if ('error' in result) {
        dropped.push(`${name} set ${setPosition + 1}: ${result.error}`);
      } else {
        sets.push(result.set);
        clamped = clamped || result.rirClamped;
      }
    });
    if (sets.length === 0) {
      dropped.push(`${name}: no usable sets`);
      return;
    }
    if (clamped) rirClamped.push(name);
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
      rirClamped,
    },
  };
}

/** The lines shown after planning: the explanation, missing exercises, adjusted and dropped parts. */
export function describeAiPlan(plan: AiPlan): string {
  return [
    plan.explanation,
    ...plan.notFound.map(name => `${name} not found in your exercises.`),
    ...(plan.rirClamped.length > 0 ? [`RIR kept within ${RIR_MIN}–${RIR_MAX}: ${plan.rirClamped.join(', ')}.`] : []),
    ...(plan.dropped.length > 0 ? [`Ignored: ${plan.dropped.join('; ')}.`] : []),
  ]
    .filter(line => line !== '')
    .join('\n');
}
