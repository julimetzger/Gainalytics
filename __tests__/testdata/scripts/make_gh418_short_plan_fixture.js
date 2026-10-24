/**
 * GH-418 evidence fixture: a SHORT plan — one that fits the screen without the
 * keyboard, so the page cannot scroll at all (the audit's first case, F1).
 *
 * Usage: node make_gh418_short_plan_fixture.js <baseline.gains> <out.gains>
 *
 * The baseline unchanged, except that Micro 69 "Push" (training 282, PLANNED)
 * keeps only its first two exercises. Their planned workouts stay as they are;
 * the others are no longer referenced by the training.
 */
const fs = require('fs');

const [SRC, OUT] = process.argv.slice(2);
const TRAINING_ID = 282;
const KEEP_EXERCISES = 2;

const store = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const training = store.trainings.byId[TRAINING_ID];
if (training === undefined || training.state !== 'P') {
  throw new Error(`training ${TRAINING_ID} is missing or not PLANNED`);
}
const kept = training.exercises.slice(0, KEEP_EXERCISES);
training.exercises = kept;
training.plannedWorkouts = Object.fromEntries(Object.entries(training.plannedWorkouts ?? {}).filter(([exerciseId]) => kept.includes(Number(exerciseId))));

fs.writeFileSync(OUT, JSON.stringify(store));
console.log(`training ${TRAINING_ID}: exercises ${JSON.stringify(kept)}, planned ${JSON.stringify(training.plannedWorkouts)}`);
