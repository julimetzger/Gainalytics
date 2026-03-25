import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Training} from '../../app/models/entities/Training';
import {TrainingsState} from '../../app/models/TrainingsState';
import {aggregateTrainingLengths, formatTrainingLength} from '../../app/utils/training-length-analysis';

const createTraining = (training: Partial<Training>) =>
  ({
    id: training.id,
    doneWorkoutIds: training.doneWorkoutIds ?? {},
    plannedWorkouts: training.plannedWorkouts ?? {},
    exercises: training.exercises ?? [],
    notes: training.notes,
    start: training.start,
    end: training.end,
    state: training.state ?? TrainingsState.PLANNED,
  }) satisfies Training;

describe('training-length-analysis', () => {
  it('aggregates completed training duration by day, week, and month while ignoring incomplete trainings', () => {
    const trainings = [
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-03T10:00:00.000Z'),
        end: new Date('2026-03-03T11:30:00.000Z'),
      }),
      createTraining({
        id: 2,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-05T14:00:00.000Z'),
        end: new Date('2026-03-05T15:00:00.000Z'),
      }),
      createTraining({
        id: 3,
        state: TrainingsState.FINISHED,
        start: new Date('2026-04-02T09:00:00.000Z'),
        end: new Date('2026-04-02T11:15:00.000Z'),
      }),
      createTraining({
        id: 4,
        state: TrainingsState.PLANNED,
        start: new Date('2026-03-06T09:00:00.000Z'),
      }),
      createTraining({
        id: 5,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-07T09:00:00.000Z'),
      }),
    ];

    const marchThird = new Date(2026, 2, 3);
    marchThird.setHours(0, 0, 0, 0);
    const marchFifth = new Date(2026, 2, 5);
    marchFifth.setHours(0, 0, 0, 0);
    const aprilSecond = new Date(2026, 3, 2);
    aprilSecond.setHours(0, 0, 0, 0);
    const marchSecondWeekStart = new Date(2026, 2, 2);
    marchSecondWeekStart.setHours(0, 0, 0, 0);
    const marchThirtiethWeekStart = new Date(2026, 2, 30);
    marchThirtiethWeekStart.setHours(0, 0, 0, 0);
    const marchMonthStart = new Date(2026, 2, 1);
    marchMonthStart.setHours(0, 0, 0, 0);
    const aprilMonthStart = new Date(2026, 3, 1);
    aprilMonthStart.setHours(0, 0, 0, 0);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.SINGLE_DAY)).toEqual([
      {
        key: marchThird.toISOString(),
        startDate: new Date(marchThird),
        x: marchThird.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 90,
        trainingCount: 1,
        trainingIds: [1],
      },
      {
        key: marchFifth.toISOString(),
        startDate: new Date(marchFifth),
        x: marchFifth.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 60,
        trainingCount: 1,
        trainingIds: [2],
      },
      {
        key: aprilSecond.toISOString(),
        startDate: new Date(aprilSecond),
        x: aprilSecond.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainingIds: [3],
      },
    ]);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.WEEK)).toEqual([
      {
        key: marchSecondWeekStart.toISOString(),
        startDate: new Date(marchSecondWeekStart),
        x: marchSecondWeekStart.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 150,
        trainingCount: 2,
        trainingIds: [1, 2],
      },
      {
        key: marchThirtiethWeekStart.toISOString(),
        startDate: new Date(marchThirtiethWeekStart),
        x: marchThirtiethWeekStart.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainingIds: [3],
      },
    ]);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.MONTH)).toEqual([
      {
        key: marchMonthStart.toISOString(),
        startDate: new Date(marchMonthStart),
        x: marchMonthStart.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 150,
        trainingCount: 2,
        trainingIds: [1, 2],
      },
      {
        key: aprilMonthStart.toISOString(),
        startDate: new Date(aprilMonthStart),
        x: aprilMonthStart.getTime() / (1000 * 60 * 60 * 24),
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainingIds: [3],
      },
    ]);
  });

  it('formats duration values for the training length screen', () => {
    expect([
      formatTrainingLength(45),
      formatTrainingLength(60),
      formatTrainingLength(95),
    ]).toEqual(['45 min', '1 h', '1 h 35 min']);
  });
});
