import {useOneRmSessionHistory} from '../../../app/redux/Workout/use/useOneRmSessionHistory';
import {oneRmPerWorkoutValues} from '../../../app/components/exercise/show/exerciseStats';
import {Workout} from '../../../app/models/entities/Workout';

let mockState: any;

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

// A single (1 rep, 0 RIR) set makes the e1RM equal to the weight.
const single = (weight: number) => ({weight, reps: 1, rir: 0});
const workout = (id: number, end: string | undefined, ...weights: number[]): Workout => ({
  id,
  exerciseId: 1,
  end: end === undefined ? undefined : new Date(end),
  sets: weights.map(single),
});

describe('oneRmPerWorkoutValues (GH-477)', () => {
  it('returns one point per finished session, including sessions weaker than the record', () => {
    const values = oneRmPerWorkoutValues([
      workout(1, '2026-01-01', 100),
      workout(2, '2026-01-08', 120),
      workout(3, '2026-01-15', 90),
      workout(4, '2026-01-22', 110),
    ]);
    expect(values).toEqual([100, 120, 90, 110]);
  });

  it('uses the best set of each session', () => {
    expect(oneRmPerWorkoutValues([workout(1, '2026-01-01', 80, 100, 95)])).toEqual([100]);
  });

  it('orders by session end, not by store order', () => {
    const values = oneRmPerWorkoutValues([workout(2, '2026-02-01', 130), workout(1, '2026-01-01', 100)]);
    expect(values).toEqual([100, 130]);
  });

  it('skips unfinished and empty sessions', () => {
    const values = oneRmPerWorkoutValues([workout(1, '2026-01-01', 100), workout(2, undefined, 150), workout(3, '2026-01-10')]);
    expect(values).toEqual([100]);
  });

  it('keeps only the last `max` sessions', () => {
    const workouts = Array.from({length: 15}, (_, i) => workout(i + 1, `2026-01-${String(i + 1).padStart(2, '0')}`, 100 + i));
    const values = oneRmPerWorkoutValues(workouts);
    expect(values).toHaveLength(12);
    expect(values[0]).toBe(103);
    expect(values[11]).toBe(114);
  });

  it('returns an empty list for no workouts', () => {
    expect(oneRmPerWorkoutValues(undefined)).toEqual([]);
    expect(oneRmPerWorkoutValues([])).toEqual([]);
  });
});

describe('useOneRmSessionHistory (GH-477)', () => {
  it('reads the exercise workouts from the store and returns per-session e1RM values', () => {
    mockState = {
      workouts: {
        byExerciseId: {1: [1, 2, 3]},
        byId: {
          1: workout(1, '2026-01-01', 100),
          2: workout(2, '2026-01-08', 120),
          3: workout(3, '2026-01-15', 90),
        },
      },
    };
    expect(useOneRmSessionHistory(1)).toEqual([100, 120, 90]);
  });

  it('returns the same empty reference when there is no data', () => {
    mockState = {workouts: {byExerciseId: {}, byId: {}}};
    expect(useOneRmSessionHistory(undefined)).toBe(useOneRmSessionHistory(7));
    expect(useOneRmSessionHistory(7)).toEqual([]);
  });
});
