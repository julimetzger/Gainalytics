import {countMicroTrainings} from '../../app/utils/micro-training-count';
import {trainingsKpi} from '../../app/utils/overview-comparison';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {Training} from '../../app/models/entities/Training';
import {TrainingsState} from '../../app/models/TrainingsState';

const FOUR_TYPES = {1: 'Push', 2: 'Pull', 3: 'Legs', 4: 'Upper'};

const finished = (id: number): Training =>
  ({id, state: TrainingsState.FINISHED, exercises: [1], plannedWorkouts: {1: id * 10}, doneWorkoutIds: {1: id * 10 + 1}, start: new Date(2026, 9, 6, 18), end: new Date(2026, 9, 6, 19)}) satisfies Training;
const planned = (id: number): Training => ({id, state: TrainingsState.PLANNED, exercises: [1], plannedWorkouts: {1: id * 10}, doneWorkoutIds: {}}) satisfies Training;
const empty = (id: number): Training => ({id, state: TrainingsState.PLANNED, exercises: [], plannedWorkouts: {}, doneWorkoutIds: {}}) satisfies Training;

const byId = (...trainings: Training[]) => Object.fromEntries(trainings.map((training) => [String(training.id), training]));
const plan = (trainings: TrainingsPlan['trainings'], trainingNames: TrainingsPlan['trainingNames'] = FOUR_TYPES) =>
  ({id: 1, name: 'Push pull', trainings, trainingNames}) satisfies TrainingsPlan;

describe('GH-644 countMicroTrainings — the micro counter Home and the Overview share', () => {
  it('counts all trainings of the plan: 4 trainings, 1 finished, 1 with planned sets → 1 / 4', () => {
    // M7: D1 finished, D2 planned, D3 created without sets, D4 never created; M6 must not leak in
    const count = countMicroTrainings(plan({'6,1': 60, '7,1': 70, '7,2': 71, '7,3': 72}), 7, byId(finished(60), finished(70), planned(71), empty(72)));

    expect(count).toEqual({done: 1, total: 4, open: 3, notPlanned: 2});
    expect(trainingsKpi(count)).toEqual({key: 'trainings', title: 'Trainings', value: '1', reference: '4', delta: '3 open · 2 not planned', sign: 0});
  });

  it('reads a fully planned and finished micro as 4 / 4 with the usual delta', () => {
    const count = countMicroTrainings(plan({'2,1': 20, '2,2': 21, '2,3': 22, '2,4': 23}), 2, byId(finished(20), finished(21), finished(22), finished(23)));

    expect(count).toEqual({done: 4, total: 4, open: 0, notPlanned: 0});
    expect(trainingsKpi(count)).toEqual({key: 'trainings', title: 'Trainings', value: '4', reference: '4', delta: '±0 (±0%)', sign: 0});
  });

  it('counts every training of a micro without planned trainings as open and not planned', () => {
    const count = countMicroTrainings(plan({'3,1': 30, '3,2': 31}), 3, byId(empty(30), empty(31)));

    expect(count).toEqual({done: 0, total: 4, open: 4, notPlanned: 4});
    expect(trainingsKpi(count)).toEqual({key: 'trainings', title: 'Trainings', value: '0', reference: '4', delta: '4 open · 4 not planned', sign: 0});
  });

  it('leaves out "not planned" when every open training has planned sets', () => {
    const count = countMicroTrainings(plan({'2,1': 20, '2,2': 21}, {1: 'Push', 2: 'Pull'}), 2, byId(finished(20), planned(21)));

    expect(count).toEqual({done: 1, total: 2, open: 1, notPlanned: 0});
    expect(trainingsKpi(count)).toEqual({key: 'trainings', title: 'Trainings', value: '1', reference: '2', delta: '1 open', sign: 0});
  });

  it('falls back to the micro\'s slots for a plan without training types', () => {
    const count = countMicroTrainings(plan({'1,1': 10, '1,2': 11, '1,3': 12}, {}), 1, byId(finished(10), planned(11), empty(12)));

    expect(count).toEqual({done: 1, total: 3, open: 2, notPlanned: 1});
  });
});
