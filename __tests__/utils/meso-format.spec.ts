import {getMicroLabel} from '../../app/utils/meso-format';
import {Meso} from '../../app/models/entities/TrainingsPlan';

const MESO_ACCUMULATION: Meso = {id: 1, name: 'Accumulation', order: 1, startMicro: 1};
const MESO_INTENSIFICATION: Meso = {id: 2, name: 'Intensification', order: 2, startMicro: 4};
const MESO_REALIZATION: Meso = {id: 3, name: 'Realization', order: 3, startMicro: 7};

describe('getMicroLabel', () => {
  it('uses default meso "Meso 1" initial when mesos is undefined', () => {
    // getSortedMesos falls back to {name: 'Meso 1', startMicro: 1} when mesos is undefined
    expect(getMicroLabel(undefined, 3)).toBe('M3');
  });

  it('uses default meso "Meso 1" initial when mesos is empty', () => {
    expect(getMicroLabel([], 5)).toBe('M5');
  });

  it('returns correct label for first micro in first meso', () => {
    expect(getMicroLabel([MESO_ACCUMULATION, MESO_INTENSIFICATION], 1)).toBe('A1');
  });

  it('returns correct label for third micro in first meso', () => {
    expect(getMicroLabel([MESO_ACCUMULATION, MESO_INTENSIFICATION, MESO_REALIZATION], 3)).toBe('A3');
  });

  it('returns correct label for first micro in second meso', () => {
    expect(getMicroLabel([MESO_ACCUMULATION, MESO_INTENSIFICATION, MESO_REALIZATION], 4)).toBe('I1');
  });

  it('returns correct label for second micro in third meso', () => {
    expect(getMicroLabel([MESO_ACCUMULATION, MESO_INTENSIFICATION, MESO_REALIZATION], 8)).toBe('R2');
  });

  it('uses first letter of meso name (uppercase)', () => {
    const mesos: Meso[] = [{id: 1, name: 'strength', order: 1, startMicro: 1}];
    expect(getMicroLabel(mesos, 2)).toBe('S2');
  });

  it('strips umlauts: Ä → A', () => {
    const mesos: Meso[] = [{id: 1, name: 'Überlastung', order: 1, startMicro: 1}];
    expect(getMicroLabel(mesos, 1)).toBe('U1');
  });

  it('strips umlauts: ä → a (lowercase stays lowercase before toUpperCase)', () => {
    const mesos: Meso[] = [{id: 1, name: 'äquivalenz', order: 1, startMicro: 1}];
    expect(getMicroLabel(mesos, 1)).toBe('A1');
  });

  it('two mesos with same initial — both use initial, no disambiguation', () => {
    const mesos: Meso[] = [
      {id: 1, name: 'Accumulation', order: 1, startMicro: 1},
      {id: 2, name: 'Assistance', order: 2, startMicro: 5},
    ];
    expect(getMicroLabel(mesos, 2)).toBe('A2');
    expect(getMicroLabel(mesos, 6)).toBe('A2');
  });
});
