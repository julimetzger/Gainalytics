import {Exercise} from '../../../app/models/entities/Exercise';

describe('ExerciseTab focus-first sort', () => {
  function sortExercises(exercises: Exercise[]): Exercise[] {
    return [...exercises].sort((a, b) => {
      if (a.isFocus && !b.isFocus) return -1;
      if (!a.isFocus && b.isFocus) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  it('places focus exercises before non-focus exercises', () => {
    const exercises: Exercise[] = [
      {id: 1, name: 'Squat', isFocus: false},
      {id: 2, name: 'Bench Press', isFocus: true},
      {id: 3, name: 'Deadlift', isFocus: false},
    ];
    const sorted = sortExercises(exercises);
    expect(sorted[0].name).toBe('Bench Press');
    expect(sorted[1].name).toBe('Deadlift');
    expect(sorted[2].name).toBe('Squat');
  });

  it('sorts focus exercises alphabetically among themselves', () => {
    const exercises: Exercise[] = [
      {id: 1, name: 'Squat', isFocus: true},
      {id: 2, name: 'Bench Press', isFocus: true},
    ];
    const sorted = sortExercises(exercises);
    expect(sorted[0].name).toBe('Bench Press');
    expect(sorted[1].name).toBe('Squat');
  });

  it('sorts non-focus exercises alphabetically among themselves', () => {
    const exercises: Exercise[] = [
      {id: 1, name: 'Squat'},
      {id: 2, name: 'Bench Press'},
    ];
    const sorted = sortExercises(exercises);
    expect(sorted[0].name).toBe('Bench Press');
    expect(sorted[1].name).toBe('Squat');
  });

  it('treats exercises without isFocus as non-focus', () => {
    const exercises: Exercise[] = [
      {id: 1, name: 'Squat'},
      {id: 2, name: 'Bench Press', isFocus: true},
    ];
    const sorted = sortExercises(exercises);
    expect(sorted[0].name).toBe('Bench Press');
    expect(sorted[1].name).toBe('Squat');
  });
});
