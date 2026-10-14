import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {Training} from '../models/entities/Training';
import {TrainingsState} from '../models/TrainingsState';
import {
  getMicroFromTrainingInMicroIndex,
  getTrainingFromTrainingInMicroIndex,
  trainingInMicroIndex,
} from '../redux/Training/trainingsPlanReducer';

/**
 * GH-533: the dashboard jumped to the next micro as soon as the plan order said so — after
 * training D4 before D3, or with a micro whose remaining days were never planned, the user
 * saw "M7 · 0/4" on Wednesday while M6 was half done. The current micro now only moves on
 * when (a) a training of the new micro has been started, or (b) the old micro is complete
 * AND a new calendar week (Monday) has begun since its last training.
 */

/** Monday 00:00 (local time) of the week that contains `d`. */
export const startOfWeek = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return c;
};

const isBegun = (t: Training | undefined): boolean =>
  t !== undefined && (t.state === TrainingsState.STARTED || t.state === TrainingsState.FINISHED || !!t.end);

/** Training numbers of one micro: the plan's training types, or — without any — the micro's slots. */
const trainingNumbersOf = (plan: TrainingsPlan, micro: number): number[] => {
  const named = Object.keys(plan.trainingNames ?? {})
    .map(n => parseInt(n, 10))
    .filter(n => !Number.isNaN(n));
  const numbers =
    named.length > 0
      ? named
      : Object.keys(plan.trainings)
          .filter(k => getMicroFromTrainingInMicroIndex(k) === micro)
          .map(getTrainingFromTrainingInMicroIndex);
  return numbers.sort((a, b) => a - b);
};

/** Highest micro in which a training has been started or finished. */
export const lastBegunMicro = (plan: TrainingsPlan, trainingsById: {[id: number]: Training}): number | undefined => {
  let result: number | undefined;
  for (const [key, tId] of Object.entries(plan.trainings ?? {})) {
    if (!isBegun(trainingsById[tId])) continue;
    const micro = getMicroFromTrainingInMicroIndex(key);
    if (result === undefined || micro > result) result = micro;
  }
  return result;
};

/** Finished trainings of `micro` and the end of the latest one. */
const microProgress = (plan: TrainingsPlan, trainingsById: {[id: number]: Training}, micro: number) => {
  let done = 0;
  let lastEnd = 0;
  for (const [key, tId] of Object.entries(plan.trainings ?? {})) {
    if (getMicroFromTrainingInMicroIndex(key) !== micro) continue;
    const end = trainingsById[tId]?.end;
    if (!end) continue;
    done++;
    lastEnd = Math.max(lastEnd, new Date(end).getTime());
  }
  return {done, total: trainingNumbersOf(plan, micro).length, lastEnd};
};

/**
 * The micro the dashboard shows as "current". `candidateMicro` is the micro the plan order
 * would move to next (the next session's micro); it only wins once the switch rule allows it.
 */
export function resolveCurrentMicro(
  plan: TrainingsPlan,
  trainingsById: {[id: number]: Training},
  candidateMicro: number,
  now: Date = new Date(),
): number {
  const begun = lastBegunMicro(plan, trainingsById);
  // (a) a training of the candidate micro (or a later one) has been started.
  if (begun === undefined || candidateMicro <= begun) return candidateMicro;
  const {done, total, lastEnd} = microProgress(plan, trainingsById, begun);
  // (b) the old micro is complete and a new week has begun since its last training.
  const complete = total > 0 && done >= total;
  if (complete && lastEnd > 0 && startOfWeek(now).getTime() > startOfWeek(new Date(lastEnd)).getTime()) {
    return candidateMicro;
  }
  return begun;
}

/**
 * The next open training of `micro`: the first one after the latest finished training of
 * that micro, otherwise the first open one before it. `undefined` when the micro is complete.
 */
export function nextOpenTrainingInMicro(
  plan: TrainingsPlan,
  trainingsById: {[id: number]: Training},
  micro: number,
): number | undefined {
  const isDone = (n: number) => {
    const tId = plan.trainings[trainingInMicroIndex(micro, n)];
    return tId !== undefined && !!trainingsById[tId]?.end;
  };
  let lastDoneNumber: number | undefined;
  let lastDoneEnd = 0;
  for (const [key, tId] of Object.entries(plan.trainings ?? {})) {
    if (getMicroFromTrainingInMicroIndex(key) !== micro) continue;
    const end = trainingsById[tId]?.end;
    if (end && new Date(end).getTime() >= lastDoneEnd) {
      lastDoneEnd = new Date(end).getTime();
      lastDoneNumber = getTrainingFromTrainingInMicroIndex(key);
    }
  }
  const open = trainingNumbersOf(plan, micro).filter(n => !isDone(n));
  if (open.length === 0) return undefined;
  return open.find(n => lastDoneNumber === undefined || n > lastDoneNumber) ?? open[0];
}
