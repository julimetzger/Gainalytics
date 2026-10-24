/**
 * GH-532 evidence fixtures for the Dashboard's muscle radar ("this week vs last week").
 *
 * The baseline store is months old, so both weeks are empty on the device. This shifts
 * every date of the baseline by a constant offset so that
 *
 *   gh532_this_week.gains        the last logged workout ends on this week's Wednesday 20:00 →
 *                                this week AND last week hold sets (radar + dashed last-week
 *                                polygon). Anchored to Monday, so the per-muscle values are the
 *                                same on every weekday (sessions may lie in the future early in
 *                                the week; the Dashboard counts the whole Mon–Sun week).
 *   gh532_last_week_only.gains   the last logged workout ended on last week's Sunday → this
 *                                week is empty, only the last-week polygon is drawn
 *
 * Week boundaries are local (Monday 00:00) in `TZ` (default Europe/Berlin, the test phone).
 * Regenerate on the day of the run.
 *
 * Usage: node make_gh532_radar_fixtures.js <baseline.gains> <outDir> [nowMs]
 */
const fs = require('fs');
const path = require('path');

const [, , SRC, OUT_DIR, nowArg] = process.argv;
const NOW = nowArg ? Number(nowArg) : Date.now();
process.env.TZ = process.env.TZ || 'Europe/Berlin';

const HOUR = 3600000;
const now = new Date(NOW);
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();

const baseline = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const lastWorkoutEnd = Math.max(
  ...Object.values(baseline.workouts.byId)
    .filter((w) => w.sets && w.sets.length > 0)
    .map((w) => Number(new Date(w.end ?? w.start).getTime()))
    .filter(Boolean),
);

const LO = 1.5e12;
const HI = 1.8e12;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function shift(delta) {
  let count = 0;
  const walk = (v, key) => {
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) v[k] = walk(v[k], k);
      return v;
    }
    if (key === 'id' || (typeof key === 'string' && key.endsWith('Id'))) return v;
    if (typeof v === 'number' && v > LO && v < HI) {
      count++;
      return v + delta;
    }
    if (typeof v === 'string' && ISO.test(v)) {
      count++;
      return new Date(Date.parse(v) + delta).toISOString();
    }
    return v;
  };
  const copy = JSON.parse(JSON.stringify(baseline));
  const out = {};
  for (const [k, v] of Object.entries(copy)) out[k] = k === 'settings' || k === '_persist' ? v : walk(v, k);
  return {out, count};
}

fs.mkdirSync(OUT_DIR, {recursive: true});
for (const [name, target] of [
  ['gh532_this_week.gains', monday + 2 * 24 * HOUR + 20 * HOUR],
  ['gh532_last_week_only.gains', monday - 6 * HOUR],
]) {
  const delta = target - lastWorkoutEnd;
  const {out, count} = shift(delta);
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(out));
  console.log(`${name}: shifted ${count} values by ${(delta / 86400000).toFixed(2)} days, last workout ends ${new Date(target).toString()}`);
}
