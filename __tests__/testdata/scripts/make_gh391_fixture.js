/**
 * GH-391 evidence fixture.
 *
 * The baseline `.gains` store has no planned session left in the active plan
 * ("Push pull", plan 5, last trained micro 6) — every slot is FINISHED. Without
 * planned data the criteria about the planning context cannot be exercised at
 * all, so this derives a fixture that adds what a user would have after
 * planning the next micro.
 *
 * What is added, and nothing else:
 *   - plan 5 gains two slots, micro 7 position 1 ("Push squat") and position 2
 *     ("Pull dl "), each a PLANNED training
 *   - their plannedWorkouts are copies of the plans of micros 5,1 / 5,2 (same
 *     exercises, same sets) under fresh workout ids
 *   - the first exercise of 7,1 gets GH-63 rep/RIR ranges on its sets, so the
 *     "a range must stay a range" criterion has something to prove
 *
 * Everything else — exercises, workouts, finished trainings, settings — is
 * copied verbatim from the baseline.
 */
const fs = require('fs');

const SRC = process.argv[2];
const OUT = process.argv[3];

const store = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const plan = store.trainingsPlan.byId[5];

// The baseline store carries a stray `undefined` key in workouts.byId — filter
// non-numeric keys or the next id comes out NaN and every reference is dropped.
const nextId = obj => Math.max(...Object.keys(obj).map(Number).filter(Number.isFinite)) + 1;
let workoutId = nextId(store.workouts.byId);
let trainingId = nextId(store.trainings.byId);

/** Copy one training's plan into fresh workouts. */
function copyPlan(sourceTrainingId, withRangesForFirstExercise) {
  const source = store.trainings.byId[sourceTrainingId];
  const plannedWorkouts = {};
  const exerciseIds = Object.keys(source.plannedWorkouts);
  exerciseIds.forEach((exerciseId, index) => {
    const original = store.workouts.byId[source.plannedWorkouts[exerciseId]];
    const id = workoutId++;
    const sets = original.sets.map((set, setIndex) => {
      const copy = {...set, index: set.index ?? setIndex};
      delete copy.record;
      if (withRangesForFirstExercise && index === 0) {
        // a planned range: 3 more reps and 2 more RIR than the fixed target
        copy.repsMax = copy.reps + 3;
        copy.rirMax = copy.rir + 2;
      }
      return copy;
    });
    store.workouts.byId[id] = {
      id,
      exerciseId: Number(exerciseId),
      sets,
    };
    store.workouts.allIds.push(id);
    plannedWorkouts[exerciseId] = id;
  });
  return {plannedWorkouts, exercises: exerciseIds.map(Number)};
}

function addPlannedTraining(slotKey, sourceTrainingId, withRanges) {
  const {plannedWorkouts, exercises} = copyPlan(sourceTrainingId, withRanges);
  const id = trainingId++;
  store.trainings.byId[id] = {
    id,
    state: 'P',
    exercises,
    plannedWorkouts,
    doneWorkoutIds: {},
  };
  store.trainings.allIds.push(id);
  plan.trainings[slotKey] = id;
  return id;
}

const pushSquat = addPlannedTraining('7,1', 378, true);
const pullDl = addPlannedTraining('7,2', 379, false);

/**
 * Shift every timestamp so the newest finished training lands yesterday. The
 * baseline's last session is from February; without the shift the chat's
 * 7d/28d/3M window is empty and the pre-existing time-range selection cannot be
 * exercised at all. Relative order — and therefore which micro is "current" —
 * is untouched.
 */
const TIMESTAMP_KEYS = new Set(['start', 'end', 'date', 'createdAt', 'calibratedAt', 'timestamp']);

function eachTimestamp(node, visit) {
  if (Array.isArray(node)) {
    node.forEach(child => eachTimestamp(child, visit));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (TIMESTAMP_KEYS.has(key) && typeof value === 'number' && value > 1e12) {
      node[key] = visit(value);
    } else {
      eachTimestamp(value, visit);
    }
  }
}

let latestEnd = 0;
for (const training of Object.values(store.trainings.byId)) {
  if (typeof training.end === 'number' && training.end > latestEnd) latestEnd = training.end;
}
const target = Date.now() - 24 * 3600 * 1000;
const shift = target - latestEnd;
eachTimestamp(store, value => value + shift);

fs.writeFileSync(OUT, JSON.stringify(store));
console.log(`shifted every timestamp by ${Math.round(shift / 86400000)} days (last session -> yesterday)`);
console.log(`planned 7,1 -> training ${pushSquat} (with ranges), 7,2 -> training ${pullDl}`);
console.log(`workouts now ${store.workouts.allIds.length}, trainings now ${store.trainings.allIds.length}`);
