import {
  buildHeatmapModel,
  buildMuscleLaneModel,
  buildRecordCards,
  bundleCounts,
  countRecordsThisWeek,
  deltaToPreviousRecord,
  findProducingSet,
  MAX_DAY_GRID_COLUMNS,
  MAX_LANE_BUCKETS,
  muscleGroupOf,
  statusLine,
  unitForAccumulation,
} from '../../app/utils/RecordsAnalysis';
import {Accumulation} from '../../app/components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Exercise, Record} from '../../app/models/entities/Exercise';
import {Muscles} from '../../app/models/Muscles';
import {Workout} from '../../app/models/entities/Workout';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';

const recordWorkout = (id: number, exerciseId: number, start: Date, oneRm: number, overrides: Partial<Workout> = {}): Workout => ({
  id,
  exerciseId,
  start,
  sets: [{reps: 5, rir: 1, weight: 100}],
  records: {[Record.ONE_RM]: oneRm},
  ...overrides,
});

const squat: Exercise = {
  id: 1,
  name: 'Barbell back squat',
  muscles: [
    {muscle: Muscles.QUADS, percent: 60},
    {muscle: Muscles.GLUTES, percent: 30},
    {muscle: Muscles.BACK, percent: 10},
  ],
  records: {
    [Record.ONE_RM]: [
      {value: 175, workoutId: 10},
      {value: 182.5, workoutId: 11},
    ],
  },
};

const bench: Exercise = {
  id: 2,
  name: 'Bench press',
  muscles: [
    {muscle: Muscles.CHEST, percent: 70},
    {muscle: Muscles.TRICEPS, percent: 30},
  ],
  records: {
    [Record.ONE_RM]: [{value: 128, workoutId: 20}],
  },
};

describe('muscleGroupOf', () => {
  it('maps the dominant muscle to its group', () => {
    expect(muscleGroupOf(squat)).toBe('Legs');
    expect(muscleGroupOf(bench)).toBe('Chest');
  });

  it('maps biceps/triceps to Arms', () => {
    expect(muscleGroupOf({name: 'Curls', muscles: [{muscle: Muscles.BICEPS, percent: 100}]})).toBe('Arms');
  });

  it('returns undefined without muscle data', () => {
    expect(muscleGroupOf({name: 'Mystery'})).toBeUndefined();
    expect(muscleGroupOf(undefined)).toBeUndefined();
  });
});

describe('unitForAccumulation', () => {
  it('defaults to week', () => {
    expect(unitForAccumulation(undefined)).toBe('week');
    expect(unitForAccumulation(new Accumulation(AccumulationMode.WEEK))).toBe('week');
  });

  it('maps the other modes', () => {
    expect(unitForAccumulation(new Accumulation(AccumulationMode.MONTH))).toBe('month');
    expect(unitForAccumulation(new Accumulation(AccumulationMode.SINGLE_DAY))).toBe('day');
    expect(unitForAccumulation(new Accumulation(AccumulationMode.TRAINING_MICROCYCLE))).toBe('micro');
  });
});

describe('bundleCounts', () => {
  it('returns counts unchanged when within the limit', () => {
    expect(bundleCounts([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('merges adjacent counts when above the limit', () => {
    expect(bundleCounts([1, 2, 3, 4, 5, 6], 3)).toEqual([3, 7, 11]);
  });
});

describe('buildHeatmapModel — week mode', () => {
  // Range: Mon 2026-03-23 .. Sun 2026-06-28
  const rangeStart = new Date(2026, 2, 23);
  const rangeEnd = new Date(2026, 5, 28, 23, 59, 59);
  const workouts = [
    recordWorkout(1, 1, new Date(2026, 2, 24), 100), // week of Mar 23
    recordWorkout(2, 1, new Date(2026, 2, 26), 101), // week of Mar 23
    recordWorkout(3, 2, new Date(2026, 5, 24), 102), // week of Jun 22
  ];

  const model = buildHeatmapModel(workouts, rangeStart, rangeEnd, new Accumulation(AccumulationMode.WEEK));

  it('creates one row per month in the range', () => {
    expect(model.rows.map((row) => row.label)).toEqual(['Mar', 'Apr', 'May', 'Jun']);
  });

  it('counts records per week and finds the best week', () => {
    expect(model.maxCount).toBe(2);
    const marchRow = model.rows[0];
    const bestCell = marchRow.cells.find((cell) => cell.key === model.bestKey);
    expect(bestCell?.count).toBe(2);
  });

  it('leaves weeks without records at zero', () => {
    const aprilRow = model.rows[1];
    expect(aprilRow.cells.every((cell) => cell.count === 0)).toBe(true);
  });
});

describe('buildHeatmapModel — month mode', () => {
  const model = buildHeatmapModel(
    [recordWorkout(1, 1, new Date(2026, 2, 24), 100), recordWorkout(2, 1, new Date(2026, 4, 2), 101)],
    new Date(2026, 2, 22),
    new Date(2026, 5, 28),
    new Accumulation(AccumulationMode.MONTH),
  );

  it('renders a single row with month sublabels', () => {
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].cells.map((cell) => cell.sublabel)).toEqual(['Mar', 'Apr', 'May', 'Jun']);
    expect(model.rows[0].cells.map((cell) => cell.count)).toEqual([1, 0, 1, 0]);
  });
});

describe('buildHeatmapModel — day mode', () => {
  const rangeStart = new Date(2026, 5, 1); // Mon Jun 1
  const rangeEnd = new Date(2026, 5, 14, 23, 59, 59); // Sun Jun 14
  const model = buildHeatmapModel(
    [
      recordWorkout(1, 1, new Date(2026, 5, 1, 18), 100), // Mon week 1
      recordWorkout(2, 1, new Date(2026, 5, 1, 20), 101), // Mon week 1 (same day)
      recordWorkout(3, 2, new Date(2026, 5, 10, 9), 102), // Wed week 2
    ],
    rangeStart,
    rangeEnd,
    new Accumulation(AccumulationMode.SINGLE_DAY),
  );

  it('renders weekday rows Monday first', () => {
    expect(model.rows.map((row) => row.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('places counts on the real training days', () => {
    expect(model.rows[0].cells.map((cell) => cell.count)).toEqual([2, 0]); // Mondays
    expect(model.rows[2].cells.map((cell) => cell.count)).toEqual([0, 1]); // Wednesdays
    expect(model.rows[1].cells.every((cell) => cell.count === 0)).toBe(true); // Tuesdays
  });

  it('bundles week columns for large ranges', () => {
    const bigModel = buildHeatmapModel([], new Date(2025, 0, 1), new Date(2026, 5, 28), new Accumulation(AccumulationMode.SINGLE_DAY));
    expect(bigModel.rows[0].cells.length).toBeLessThanOrEqual(MAX_DAY_GRID_COLUMNS);
  });

  it('keeps bestCount a single day even when cells are bundled', () => {
    // 20 weeks → columns bundle; two Mondays with 3 and 2 records fall into
    // separate bundles of otherwise empty weeks except one bundle summing 3+2.
    const workouts = [
      recordWorkout(1, 1, new Date(2026, 0, 5, 10), 100),
      recordWorkout(2, 1, new Date(2026, 0, 5, 12), 101),
      recordWorkout(3, 1, new Date(2026, 0, 5, 14), 102),
      recordWorkout(4, 1, new Date(2026, 0, 12, 10), 103),
      recordWorkout(5, 1, new Date(2026, 0, 12, 12), 104),
    ];
    const bundledModel = buildHeatmapModel(workouts, new Date(2025, 9, 1), new Date(2026, 1, 28), new Accumulation(AccumulationMode.SINGLE_DAY));
    // Jan 5 and Jan 12 are adjacent weeks → same bundle → cell shows 5,
    // but the best single day stays 3.
    expect(bundledModel.maxCount).toBe(5);
    expect(bundledModel.bestCount).toBe(3);
  });
});

describe('buildHeatmapModel — micro mode', () => {
  const plan: TrainingsPlan = {
    id: 7,
    name: 'Strength block',
    trainings: {
      '1,1': 100,
      '1,2': 101,
      '2,1': 102,
      '3,1': 103,
      '4,1': 104,
    },
    trainingNames: {},
    mesos: [
      {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
      {id: 2, name: 'Meso 2', order: 2, startMicro: 3},
    ],
  };
  const accumulation = Accumulation.fromTrainingsPlan(plan);
  const model = buildHeatmapModel(
    [
      recordWorkout(1, 1, new Date(2026, 2, 24), 100, {trainingsId: 100}),
      recordWorkout(2, 1, new Date(2026, 2, 25), 101, {trainingsId: 101}),
      recordWorkout(3, 2, new Date(2026, 3, 10), 102, {trainingsId: 103}),
    ],
    new Date(2026, 2, 1),
    new Date(2026, 5, 28),
    accumulation,
  );

  it('renders one row per meso with the plan micros as cells', () => {
    expect(model.rows.map((row) => row.label)).toEqual(['Meso 1', 'Meso 2']);
    expect(model.rows[0].cells).toHaveLength(2); // micros 1-2
    expect(model.rows[1].cells).toHaveLength(2); // micros 3-4
  });

  it('counts records per micro via the workout trainingsId', () => {
    expect(model.rows[0].cells[0].count).toBe(2); // micro 1: workouts 1+2
    expect(model.rows[1].cells[0].count).toBe(1); // micro 3: workout 3
    expect(model.maxCount).toBe(2);
  });

  it('returns an empty model when no plan is attached', () => {
    const noPlan = buildHeatmapModel([], new Date(2026, 2, 1), new Date(2026, 5, 28), new Accumulation(AccumulationMode.TRAINING_MICROCYCLE));
    expect(noPlan.rows).toHaveLength(0);
  });
});

describe('buildMuscleLaneModel', () => {
  const rangeStart = new Date(2026, 2, 23);
  const rangeEnd = new Date(2026, 5, 28, 23, 59, 59);
  const workouts = [
    recordWorkout(10, 1, new Date(2026, 2, 24), 175), // Legs
    recordWorkout(11, 1, new Date(2026, 3, 8), 182.5), // Legs
    recordWorkout(20, 2, new Date(2026, 3, 8), 128), // Chest
  ];

  const model = buildMuscleLaneModel(workouts, [squat, bench], rangeStart, rangeEnd, new Accumulation(AccumulationMode.WEEK));

  it('creates lanes sorted by total records descending', () => {
    expect(model.lanes.map((lane) => lane.group)).toEqual(['Legs', 'Chest']);
    expect(model.lanes[0].total).toBe(2);
    expect(model.lanes[0].color).toBe('#B1D18A');
  });

  it('spreads counts over the week buckets', () => {
    const legs = model.lanes[0];
    expect(legs.counts.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(legs.counts.length).toBe(model.bucketLabels.length);
  });

  it('labels the buckets where a month starts', () => {
    expect(model.bucketLabels[0]).toBe('Mar');
    expect(model.bucketLabels.filter((label) => label !== undefined).length).toBeGreaterThanOrEqual(3);
  });

  it('bundles buckets in day mode for long ranges', () => {
    const dayModel = buildMuscleLaneModel(workouts, [squat, bench], rangeStart, rangeEnd, new Accumulation(AccumulationMode.SINGLE_DAY));
    expect(dayModel.bucketLabels.length).toBeLessThanOrEqual(MAX_LANE_BUCKETS);
    expect(dayModel.lanes[0].counts.length).toBe(dayModel.bucketLabels.length);
  });
});

describe('findProducingSet', () => {
  it('prefers the set tagged with the 1RM record', () => {
    const workout: Workout = {
      exerciseId: 1,
      sets: [
        {reps: 8, rir: 2, weight: 120},
        {reps: 5, rir: 1, weight: 150, record: [Record.ONE_RM]},
      ],
    };
    expect(findProducingSet(workout)?.weight).toBe(150);
  });

  it('falls back to the set with the highest estimated 1RM', () => {
    const workout: Workout = {
      exerciseId: 1,
      sets: [
        {reps: 5, rir: 1, weight: 150},
        {reps: 2, rir: 0, weight: 170},
      ],
    };
    expect(findProducingSet(workout)?.weight).toBe(170);
  });

  it('returns undefined for empty sets', () => {
    expect(findProducingSet({exerciseId: 1, sets: []})).toBeUndefined();
  });
});

describe('deltaToPreviousRecord', () => {
  it('computes the delta vs the previous 1RM record of the same exercise', () => {
    const workout = recordWorkout(11, 1, new Date(2026, 3, 8), 182.5);
    expect(deltaToPreviousRecord(squat, workout)).toBeCloseTo(7.5);
  });

  it('returns undefined for the first record of an exercise', () => {
    const workout = recordWorkout(10, 1, new Date(2026, 2, 24), 175);
    expect(deltaToPreviousRecord(squat, workout)).toBeUndefined();
  });

  it('handles string record values from persisted stores', () => {
    const exercise: Exercise = {
      id: 3,
      name: 'Deadlift',
      records: {[Record.ONE_RM]: [{value: '200.00' as unknown as number, workoutId: 30}, {value: '207.50' as unknown as number, workoutId: 31}]},
    };
    const workout = recordWorkout(31, 3, new Date(2026, 3, 8), 207.5);
    expect(deltaToPreviousRecord(exercise, workout)).toBeCloseTo(7.5);
  });
});

describe('buildRecordCards', () => {
  const workouts = [
    recordWorkout(20, 2, new Date(2026, 5, 24), 128, {sets: [{reps: 6, rir: 2, weight: 100, record: [Record.ONE_RM]}]}),
    recordWorkout(11, 1, new Date(2026, 5, 25), 182.5, {sets: [{reps: 5, rir: 1, weight: 150, record: [Record.ONE_RM]}]}),
  ];

  const cards = buildRecordCards(workouts, [squat, bench]);

  it('sorts by 1RM descending and marks the top PR', () => {
    expect(cards.map((card) => card.exerciseName)).toEqual(['Barbell back squat', 'Bench press']);
    expect(cards[0].isTop).toBe(true);
    expect(cards[1].isTop).toBe(false);
  });

  it('fills the card fields from the producing set and exercise', () => {
    const top = cards[0];
    expect(top.oneRm).toBe(182.5);
    expect(top.setLine).toBe('150 kg × 5 @ 1 RIR');
    expect(top.group).toBe('Legs');
    expect(top.dateLabel).toBe('Jun 25');
    expect(top.delta).toBeCloseTo(7.5);
  });

  it('skips workouts without a finite 1RM record', () => {
    const broken = recordWorkout(99, 1, new Date(2026, 5, 20), NaN);
    expect(buildRecordCards([broken], [squat])).toHaveLength(0);
  });
});

describe('countRecordsThisWeek / statusLine', () => {
  const now = new Date(2026, 5, 25); // Thu Jun 25 2026
  it('counts only records in the current Mon–Sun week', () => {
    const workouts = [
      recordWorkout(1, 1, new Date(2026, 5, 22), 100), // Mon this week
      recordWorkout(2, 1, new Date(2026, 5, 28), 101), // Sun this week
      recordWorkout(3, 1, new Date(2026, 5, 21), 102), // Sun previous week
    ];
    expect(countRecordsThisWeek(workouts, now)).toBe(2);
  });

  it('builds the status line', () => {
    expect(statusLine(6)).toBe('Still climbing — 6 PRs this week');
    expect(statusLine(1)).toBe('Still climbing — 1 PR this week');
    expect(statusLine(0)).toBe('No PRs this week yet');
  });
});
