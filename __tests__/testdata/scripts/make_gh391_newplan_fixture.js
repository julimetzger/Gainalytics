/**
 * GH-391 review fixture — an older, finished plan next to a brand new one.
 *
 * The reported misbehaviour: a user who has just created a plan and has not
 * trained a single session from it saw no planning in the chat, because an older
 * plan with finished sessions won the "which plan is the athlete in" decision.
 *
 * This derives that exact situation from the baseline store:
 *   - plan 5 "Push pull" stays as it is: fully trained, its last session is the
 *     most recent one in the whole store (after the timestamp shift: yesterday)
 *   - a NEW plan is appended with micro 1 (two sessions) and micro 2 (one), all
 *     PLANNED, nothing ever trained, no `lastTraining`
 *   - the first exercise of the first new session carries GH-63 rep/RIR ranges
 *
 * Everything else is copied verbatim from the baseline, so the store is the one
 * the user really has plus one freshly planned block.
 *
 * Usage: node make_gh391_newplan_fixture.js <baseline.gains> <out.gains>
 */
const fs = require('fs');

const SRC = process.argv[2];
const OUT = process.argv[3];

const store = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// The baseline store carries a stray `undefined` key in workouts.byId — filter
// non-numeric keys or the next id comes out NaN and every reference is dropped.
const nextId = obj => Math.max(...Object.keys(obj).map(Number).filter(Number.isFinite)) + 1;
let workoutId = nextId(store.workouts.byId);
let trainingId = nextId(store.trainings.byId);
const newPlanId = nextId(store.trainingsPlan.byId);

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
        copy.repsMax = copy.reps + 3;
        copy.rirMax = copy.rir + 2;
      }
      return copy;
    });
    store.workouts.byId[id] = {id, exerciseId: Number(exerciseId), sets};
    store.workouts.allIds.push(id);
    plannedWorkouts[exerciseId] = id;
  });
  return {plannedWorkouts, exercises: exerciseIds.map(Number)};
}

const newPlan = {
  id: newPlanId,
  name: 'New block 2026',
  trainings: {},
  trainingNames: {1: 'Squat day', 2: 'Bench day'},
  mesos: [{id: 1, name: 'Prep', order: 1, startMicro: 1}],
};

function addPlannedTraining(slotKey, sourceTrainingId, withRanges) {
  const {plannedWorkouts, exercises} = copyPlan(sourceTrainingId, withRanges);
  const id = trainingId++;
  store.trainings.byId[id] = {id, state: 'P', exercises, plannedWorkouts, doneWorkoutIds: {}};
  store.trainings.allIds.push(id);
  newPlan.trainings[slotKey] = id;
  return id;
}

// micro 1 holds the two upcoming sessions, micro 2 the one after them — the
// bound of the context (current + next micro) has to be visible in the evidence.
const squatDay = addPlannedTraining('1,1', 378, true);
const benchDay = addPlannedTraining('1,2', 379, false);
const nextMicro = addPlannedTraining('2,1', 378, false);

store.trainingsPlan.byId[newPlanId] = newPlan;
store.trainingsPlan.allIds.push(newPlanId);

/**
 * Shift every timestamp so the newest finished training lands yesterday — the
 * finished half of the chat context is filtered by a 7d/28d/3M window and would
 * otherwise be empty. Relative order is untouched, so plan 5 stays the most
 * recently trained plan: exactly the plan that used to beat the new one.
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
const shift = Date.now() - 24 * 3600 * 1000 - latestEnd;
eachTimestamp(store, value => value + shift);

fs.writeFileSync(OUT, JSON.stringify(store));
console.log(`shifted every timestamp by ${Math.round(shift / 86400000)} days (last session -> yesterday)`);
console.log(`new plan ${newPlanId} "${newPlan.name}": 1,1 -> ${squatDay} (ranges), 1,2 -> ${benchDay}, 2,1 -> ${nextMicro}`);
