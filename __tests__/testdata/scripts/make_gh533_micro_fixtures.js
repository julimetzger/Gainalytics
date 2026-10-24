/**
 * GH-533 evidence fixtures — when does the dashboard's "Current micro" move on?
 *
 * The baseline store's active plan ("Push pull", plan 5) already shows the bug:
 * micro 6 holds only day 4 (finished), so the dashboard jumps to M7 · 0/4. This
 * derives four stores from it, dated relative to the week of `now`:
 *
 *   incomplete_midweek    M6 D1 + D4 finished this week          → stays on M6 (2/4), next M6 D2
 *   new_micro_started     same, plus M7 D1 STARTED (running)      → switches to M7
 *   complete_new_week     M6 D1–D4 finished LAST week             → switches to M7 (0/4)
 *   complete_same_week    M6 D1–D4 finished THIS week             → stays on M6 (4/4), next M7 D1
 *
 * Dates are written in UTC because the emulators run on GMT. Regenerate before every
 * evidence run — the scenarios are tied to the current week.
 *
 * Usage: node make_gh533_micro_fixtures.js <baseline.gains> <outDir> [nowMs]
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const OUT_DIR = process.argv[3];
const NOW = process.argv[4] ? Number(process.argv[4]) : Date.now();

const DAY = 86400000;
const HOUR = 3600000;
const now = new Date(NOW);
const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const daysSinceMonday = (now.getUTCDay() + 6) % 7;
const monday = todayUtc - daysSinceMonday * DAY;

// A session on `day` (ms of 00:00 UTC) from `hour` for 90 minutes — never in the future.
const session = (day, hour) => {
  const start = Math.min(day + hour * HOUR, NOW - 2 * HOUR);
  return {start, end: start + 1.5 * HOUR};
};
// Spread n sessions over the days of this week that have begun (Monday … today).
const thisWeek = n => Array.from({length: n}, (_, i) => session(monday + Math.min(i, daysSinceMonday) * DAY, 6 + i));
const lastWeek = n => Array.from({length: n}, (_, i) => session(monday - 7 * DAY + i * DAY, 18));

const baseline = fs.readFileSync(SRC, 'utf8');
const baselineTrainings = JSON.parse(baseline).trainings.byId;

// Templates for the new sessions: the finished trainings of micro 5 (days 1–3) and micro 6 day 4.
const TEMPLATE_BY_DAY = {1: 378, 2: 379, 3: 380, 4: 381};
let nextId = 9100;

function build(days, extra) {
  const store = JSON.parse(baseline);
  const plan = store.trainingsPlan.byId[5];
  const trainings = store.trainings;
  delete plan.trainings['6,4'];
  delete trainings.byId[381];
  trainings.allIds = trainings.allIds.filter(id => id !== 381);

  let last;
  for (const [dayNum, times] of days) {
    const tpl = baselineTrainings[TEMPLATE_BY_DAY[dayNum]];
    const id = nextId++;
    trainings.byId[id] = {...JSON.parse(JSON.stringify(tpl)), id, state: 'F', start: times.start, end: times.end};
    trainings.allIds.push(id);
    plan.trainings[`6,${dayNum}`] = id;
    if (!last || times.end > trainings.byId[last].end) last = id;
  }
  plan.lastTraining = last;
  if (extra) extra(store, plan);
  return store;
}

const scenarios = {
  incomplete_midweek: build([
    [1, thisWeek(2)[0]],
    [4, thisWeek(2)[1]],
  ]),
  new_micro_started: build(
    [
      [1, thisWeek(2)[0]],
      [4, thisWeek(2)[1]],
    ],
    (store, plan) => {
      const id = nextId++;
      const tpl = baselineTrainings[378];
      store.trainings.byId[id] = {
        id,
        state: 'S',
        start: NOW - 10 * 60000,
        doneWorkoutIds: {},
        plannedWorkouts: {...tpl.plannedWorkouts},
        exercises: [...tpl.exercises],
      };
      store.trainings.allIds.push(id);
      plan.trainings['7,1'] = id;
    },
  ),
  complete_new_week: build(lastWeek(4).map((t, i) => [i + 1, t])),
  complete_same_week: build(thisWeek(4).map((t, i) => [i + 1, t])),
};

fs.mkdirSync(OUT_DIR, {recursive: true});
for (const [name, store] of Object.entries(scenarios)) {
  const file = path.join(OUT_DIR, `gh533_${name}.gains`);
  fs.writeFileSync(file, JSON.stringify(store));
  const plan = store.trainingsPlan.byId[5];
  const m6 = Object.entries(plan.trainings)
    .filter(([k]) => k.startsWith('6,') || k.startsWith('7,'))
    .map(([k, id]) => `${k}=${store.trainings.byId[id].state}@${new Date(store.trainings.byId[id].end ?? store.trainings.byId[id].start).toISOString()}`);
  console.log(file, m6.join(' '));
}
