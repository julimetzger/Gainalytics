import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {Training} from '../../app/models/entities/Training';
import {TrainingsState} from '../../app/models/TrainingsState';
import {nextOpenTrainingInMicro, resolveCurrentMicro, startOfWeek} from '../../app/utils/currentMicro';

// Wednesday, 14 Oct 2026 — the day of the GH-533 report.
const WEDNESDAY = new Date(2026, 9, 14, 16, 43);
const MONDAY = new Date(2026, 9, 12, 18, 0);
const TUESDAY = new Date(2026, 9, 13, 18, 0);
const LAST_WEEK = new Date(2026, 9, 8, 18, 0); // Thursday before

// Four training types, micros 1 (M6 in the report) and 2 (M7) fully planned.
const plan: TrainingsPlan = {
  id: 1,
  name: 'Back to power',
  trainingNames: {'1': 'Squat primary', '2': 'Bench primary', '3': 'Deadlift primary', '4': 'Upper'},
  trainings: {'1,1': 11, '1,2': 12, '1,3': 13, '1,4': 14, '2,1': 21, '2,2': 22, '2,3': 23, '2,4': 24},
};

const planned = (id: number): Training => ({id, state: TrainingsState.PLANNED, doneWorkoutIds: {}, plannedWorkouts: {}, exercises: []});
const finished = (id: number, end: Date): Training => ({...planned(id), state: TrainingsState.FINISHED, start: end, end});
const started = (id: number, start: Date): Training => ({...planned(id), state: TrainingsState.STARTED, start});

const byId = (...trainings: Training[]) => {
  const map: {[id: number]: Training} = {};
  for (const id of [11, 12, 13, 14, 21, 22, 23, 24]) map[id] = planned(id);
  for (const t of trainings) map[t.id!] = t;
  return map;
};

describe('GH-533 startOfWeek', () => {
  it('starts the week on Monday 00:00, also for a Sunday', () => {
    expect(startOfWeek(WEDNESDAY)).toEqual(new Date(2026, 9, 12));
    expect(startOfWeek(new Date(2026, 9, 18, 23, 0))).toEqual(new Date(2026, 9, 12));
    expect(startOfWeek(new Date(2026, 9, 19, 0, 1))).toEqual(new Date(2026, 9, 19));
  });
});

describe('GH-533 resolveCurrentMicro', () => {
  it('keeps an incomplete micro mid-week even though the plan order already proposes the next one', () => {
    // D1 and D4 done on Mon/Tue → plan order skips D2/D3 and proposes micro 2.
    const trainings = byId(finished(11, MONDAY), finished(14, TUESDAY));
    expect(resolveCurrentMicro(plan, trainings, 2, WEDNESDAY)).toBe(1);
  });

  it('keeps an incomplete micro even after a new week has begun', () => {
    const trainings = byId(finished(11, LAST_WEEK), finished(14, LAST_WEEK));
    expect(resolveCurrentMicro(plan, trainings, 2, WEDNESDAY)).toBe(1);
  });

  it('switches as soon as the first training of the new micro has been started', () => {
    const trainings = byId(finished(11, MONDAY), finished(14, TUESDAY), started(21, WEDNESDAY));
    expect(resolveCurrentMicro(plan, trainings, 2, WEDNESDAY)).toBe(2);
  });

  it('switches when the old micro is complete and a new week has begun', () => {
    const trainings = byId(finished(11, LAST_WEEK), finished(12, LAST_WEEK), finished(13, LAST_WEEK), finished(14, LAST_WEEK));
    expect(resolveCurrentMicro(plan, trainings, 2, WEDNESDAY)).toBe(2);
  });

  it('stays on the complete old micro within the same week', () => {
    const trainings = byId(finished(11, MONDAY), finished(12, MONDAY), finished(13, TUESDAY), finished(14, TUESDAY));
    expect(resolveCurrentMicro(plan, trainings, 2, WEDNESDAY)).toBe(1);
  });

  it('uses the slots of the micro as its size when the plan has no training types', () => {
    const untyped: TrainingsPlan = {...plan, trainingNames: {}, trainings: {'1,1': 11, '1,2': 12, '2,1': 21}};
    const trainings = byId(finished(11, LAST_WEEK), finished(12, LAST_WEEK));
    expect(resolveCurrentMicro(untyped, trainings, 2, WEDNESDAY)).toBe(2);
    expect(resolveCurrentMicro(untyped, byId(finished(11, LAST_WEEK)), 2, WEDNESDAY)).toBe(1);
  });

  it('takes the plan order unchanged when nothing has been trained yet', () => {
    expect(resolveCurrentMicro(plan, byId(), 1, WEDNESDAY)).toBe(1);
  });
});

describe('GH-533 nextOpenTrainingInMicro', () => {
  it('picks the first open training after the latest finished one', () => {
    expect(nextOpenTrainingInMicro(plan, byId(finished(11, MONDAY), finished(12, TUESDAY)), 1)).toBe(3);
  });

  it('wraps to an open training before the latest finished one', () => {
    expect(nextOpenTrainingInMicro(plan, byId(finished(11, MONDAY), finished(14, TUESDAY)), 1)).toBe(2);
  });

  it('counts unplanned days of the micro as open', () => {
    const sparse: TrainingsPlan = {...plan, trainings: {'1,1': 11, '1,2': 12, '2,1': 21}};
    expect(nextOpenTrainingInMicro(sparse, byId(finished(11, MONDAY), finished(12, TUESDAY)), 1)).toBe(3);
  });

  it('returns undefined for a complete micro', () => {
    const trainings = byId(finished(11, MONDAY), finished(12, MONDAY), finished(13, TUESDAY), finished(14, TUESDAY));
    expect(nextOpenTrainingInMicro(plan, trainings, 1)).toBeUndefined();
  });
});
