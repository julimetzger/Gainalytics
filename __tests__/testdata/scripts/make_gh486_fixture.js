/**
 * GH-486 evidence fixtures: deleting the LAST remaining exercise.
 *
 * Usage: node make_gh486_fixture.js <baseline.gains> <only-exercise.gains> <legacy-no-exercises.gains>
 *
 * only-exercise: the baseline reduced to a single exercise, "Squat" (id 2). Every
 *   training, workout, planned workout and 1RM record of the other exercises is
 *   removed, so the store is consistent — what a user has who only ever kept one
 *   exercise. "Push squat" (Meso 1 · D1) still contains Squat, so planning M7 D1
 *   from the last training yields a 1-exercise training.
 *
 * legacy-no-exercises: the same store with the exercise slice emptied but every
 *   reference to Squat left in place — what an older version left behind after the
 *   only exercise was deleted. The app must repair it on the next start.
 */
const fs = require('fs');

const [SRC, OUT_ONLY, OUT_LEGACY] = process.argv.slice(2);
const KEEP = 2;

const store = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const keep = (exerciseId) => Number(exerciseId) === KEEP;
const pick = (map = {}) => Object.fromEntries(Object.entries(map).filter(([exerciseId]) => keep(exerciseId)));

store.exercises = {
  byId: {[KEEP]: {...store.exercises.byId[KEEP], alternativeIds: []}},
  allIds: [KEEP],
};

// The baseline carries a stray `undefined` key in workouts.byId — drop it too.
const workoutsById = Object.fromEntries(Object.entries(store.workouts.byId).filter(([, workout]) => workout && keep(workout.exerciseId)));
const kept = new Set(Object.keys(workoutsById).map(Number));
store.workouts = {
  ...store.workouts,
  byId: workoutsById,
  allIds: store.workouts.allIds.filter((id) => kept.has(id)),
  byExerciseId: pick(store.workouts.byExerciseId),
  plannedWorkouts: (store.workouts.plannedWorkouts || []).filter((id) => kept.has(id)),
};

Object.values(store.trainings.byId).forEach((training) => {
  training.exercises = (training.exercises || []).filter(keep);
  training.doneWorkoutIds = pick(training.doneWorkoutIds);
  training.plannedWorkouts = pick(training.plannedWorkouts);
});

if (store.videoAnalyses && store.videoAnalyses.byId) {
  const byId = Object.fromEntries(Object.entries(store.videoAnalyses.byId).filter(([, analysis]) => keep(analysis.exerciseId)));
  store.videoAnalyses = {...store.videoAnalyses, byId, allIds: (store.videoAnalyses.allIds || []).filter((id) => byId[id] !== undefined)};
}

fs.writeFileSync(OUT_ONLY, JSON.stringify(store));
fs.writeFileSync(OUT_LEGACY, JSON.stringify({...store, exercises: {byId: {}, allIds: []}}));
