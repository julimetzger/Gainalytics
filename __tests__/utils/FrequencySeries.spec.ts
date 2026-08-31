import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Workout} from '../../app/models/entities/Workout';
import {Accumulation} from '../../app/components/picker/elements/TrainingElementPicker';
import {buildFrequencySeries, formatFrequencyCaption} from '../../app/utils/FrequencySeries';

const weekAccumulation = new Accumulation(AccumulationMode.WEEK);
const dayAccumulation = new Accumulation(AccumulationMode.SINGLE_DAY);

const workout = (id: number, start: Date): Workout => ({
  id,
  exerciseId: 7,
  sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
  start,
});

// 2024-01-01 is a Monday, so these are the starts of three consecutive ISO weeks.
const week1 = new Date(2024, 0, 1).getTime();
const week2 = new Date(2024, 0, 8).getTime();
const week3 = new Date(2024, 0, 15).getTime();

describe('buildFrequencySeries', () => {
  it('counts the trainings per week and fills training-free weeks with zero', () => {
    const workouts = [
      workout(1, new Date(2024, 0, 2, 18, 30)), // Tue of week 1
      workout(2, new Date(2024, 0, 4, 7, 5)), // Thu of week 1
      workout(3, new Date(2024, 0, 17, 19, 0)), // Wed of week 3
    ];

    expect(buildFrequencySeries(workouts, weekAccumulation)).toEqual([
      {x: week1, y: 2, marker: '2'},
      {x: week2, y: 0, marker: '0'},
      {x: week3, y: 1, marker: '1'},
    ]);
  });

  it('counts two trainings on the same day as two trainings in that week', () => {
    const workouts = [workout(1, new Date(2024, 0, 3, 9, 0)), workout(2, new Date(2024, 0, 3, 18, 0))];

    expect(buildFrequencySeries(workouts, weekAccumulation)).toEqual([{x: week1, y: 2, marker: '2'}]);
  });

  it('returns an empty series for an exercise without training history', () => {
    expect(buildFrequencySeries([], weekAccumulation)).toEqual([]);
  });

  it('does not fill gaps for accumulation modes other than week', () => {
    const workouts = [workout(1, new Date(2024, 0, 2, 12, 0)), workout(2, new Date(2024, 0, 5, 12, 0))];

    expect(buildFrequencySeries(workouts, dayAccumulation)).toEqual([
      {x: new Date(2024, 0, 2).getTime(), y: 1, marker: '1'},
      {x: new Date(2024, 0, 5).getTime(), y: 1, marker: '1'},
    ]);
  });
});

describe('formatFrequencyCaption', () => {
  it('names the week and the training count of the most recent bucket', () => {
    const series = buildFrequencySeries([workout(1, new Date(2024, 0, 17, 19, 0)), workout(2, new Date(2024, 0, 19, 19, 0))], weekAccumulation);

    expect(formatFrequencyCaption(series)).toEqual('Week of Mon, 15/01/24: 2 trainings');
  });

  it('uses the singular for a single training', () => {
    const series = buildFrequencySeries([workout(1, new Date(2024, 0, 17, 19, 0))], weekAccumulation);

    expect(formatFrequencyCaption(series)).toEqual('Week of Mon, 15/01/24: 1 training');
  });

  it('has no caption without data', () => {
    expect(formatFrequencyCaption([])).toEqual(undefined);
  });
});
