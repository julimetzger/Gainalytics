import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Workout} from '../../app/models/entities/Workout';
import {Accumulation} from '../../app/components/picker/elements/TrainingElementPicker';
import {Range} from '../../app/components/picker/date/DateRangePicker';
import {buildFrequencySeries, formatFrequencyCaption, formatFrequencySpan, frequencyQueryRange} from '../../app/utils/FrequencySeries';

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

  describe('with a selected range', () => {
    it('runs to the end of the range instead of stopping at the last training', () => {
      // Trained once in week 1, then never again. The range still ends in week 4.
      const series = buildFrequencySeries([workout(1, new Date(2024, 0, 3, 18, 0))], weekAccumulation, {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 24, 12, 0), // Wed of the week of Mon 22/01
      });

      expect(series).toEqual([
        {x: week1, y: 1, marker: '1'},
        {x: week2, y: 0, marker: '0'},
        {x: week3, y: 0, marker: '0'},
        {x: new Date(2024, 0, 22).getTime(), y: 0, marker: '0'},
      ]);
    });

    it('starts at the beginning of the range, not at the first training', () => {
      const series = buildFrequencySeries([workout(1, new Date(2024, 0, 17, 18, 0))], weekAccumulation, {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 17, 18, 0),
      });

      expect(series.map((point) => point.y)).toEqual([0, 0, 1]);
      expect(series[0].x).toEqual(week1);
    });

    it('counts the week the range starts in the middle of completely', () => {
      // The range starts on Wed 03/01. The week of Mon 01/01 is plotted as a whole week
      // and counts the Monday training as well, instead of showing a short week as a full
      // one. `frequencyQueryRange` makes sure that Monday's workout is loaded.
      const workouts = [
        workout(1, new Date(2024, 0, 1, 18, 0)), // Mon, before the range start
        workout(2, new Date(2024, 0, 3, 18, 0)), // Wed, on the range start
        workout(3, new Date(2024, 0, 9, 18, 0)), // Tue of the next week
      ];

      const series = buildFrequencySeries(workouts, weekAccumulation, {
        start: new Date(2024, 0, 3),
        end: new Date(2024, 0, 9, 18, 0),
      });

      expect(series).toEqual([
        {x: week1, y: 2, marker: '2'},
        {x: week2, y: 1, marker: '1'},
      ]);
    });

    it('keeps the first week when the range starts on a Monday', () => {
      const series = buildFrequencySeries([workout(1, new Date(2024, 0, 3, 18, 0))], weekAccumulation, {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 3, 18, 0),
      });

      expect(series).toEqual([{x: week1, y: 1, marker: '1'}]);
    });

    it('keeps the empty state for an exercise without any training in the range', () => {
      expect(buildFrequencySeries([], weekAccumulation, {start: new Date(2024, 0, 1), end: new Date(2024, 0, 24)})).toEqual([]);
    });

    it('starts at the first week with data when the range has no meaningful start (All)', () => {
      const series = buildFrequencySeries([workout(1, new Date(2024, 0, 3, 18, 0))], weekAccumulation, {
        start: undefined,
        end: new Date(2024, 0, 10, 12, 0),
      });

      expect(series).toEqual([
        {x: week1, y: 1, marker: '1'},
        {x: week2, y: 0, marker: '0'},
      ]);
    });
  });
});

describe('frequencyQueryRange', () => {
  it('grows the range back to the Monday of the week it starts in', () => {
    const range = frequencyQueryRange(new Range(new Date(2024, 0, 3), new Date(2024, 0, 9, 18, 0)));

    expect(range.startDate).toEqual(new Date(2024, 0, 1));
    expect(range.endDate).toEqual(new Date(2024, 0, 9, 18, 0));
  });

  it('leaves a range that already starts on a Monday alone', () => {
    const range = frequencyQueryRange(new Range(new Date(2024, 0, 1), new Date(2024, 0, 9)));

    expect(range.startDate).toEqual(new Date(2024, 0, 1));
  });
});

describe('formatFrequencySpan', () => {
  it('names the first and the last plotted week', () => {
    const series = buildFrequencySeries([workout(1, new Date(2024, 0, 3, 18, 0))], weekAccumulation, {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 17, 12, 0),
    });

    expect(formatFrequencySpan(series)).toEqual('Weeks from Mon, 01/01/24 to Mon, 15/01/24');
  });

  it('has no span without data', () => {
    expect(formatFrequencySpan([])).toEqual(undefined);
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

  it('marks the week that is still running as partial', () => {
    const now = new Date(2024, 0, 17, 19, 0); // Wed of the week of Mon 15/01
    const series = buildFrequencySeries([workout(1, now)], weekAccumulation, {start: new Date(2024, 0, 15), end: now});

    expect(formatFrequencyCaption(series, now)).toEqual('Week of Mon, 15/01/24: 1 training so far');
  });

  it('names the last week with a training when the range ends without one', () => {
    const now = new Date(2024, 0, 17, 19, 0);
    const series = buildFrequencySeries([workout(1, new Date(2024, 0, 3, 18, 0))], weekAccumulation, {start: new Date(2024, 0, 1), end: now});

    expect(formatFrequencyCaption(series, now)).toEqual('Week of Mon, 15/01/24: 0 trainings so far, last trained Mon, 01/01/24 (1 training)');
  });
});
