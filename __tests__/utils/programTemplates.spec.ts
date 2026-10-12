import {PROGRAM_TEMPLATES} from '../../app/constants/programTemplates';
import {ProgramTemplate} from '../../app/models/ProgramTemplate';
import {Muscles} from '../../app/models/Muscles';
import {TrainingsState} from '../../app/models/TrainingsState';
import {
  buildTemplatePlanPayload,
  formatTemplateStructure,
  normalizeExerciseName,
  plannedSetsFor,
  suggestedWeight,
  templateStructure,
} from '../../app/utils/program-templates';
import {TrainingsPlanExportPayload} from '../../app/utils/exportTrainingsPlan';

const noOneRepMax = () => 0;

describe('program templates (GH-497)', () => {
  it('ships at least two templates with unique ids', () => {
    expect(PROGRAM_TEMPLATES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(PROGRAM_TEMPLATES.map((t) => t.id)).size).toBe(PROGRAM_TEMPLATES.length);
  });

  it.each(PROGRAM_TEMPLATES.map((t) => [t.name, t] as const))('%s has one exercise list per training in every meso', (_, template) => {
    template.mesos.forEach((meso) => {
      expect(meso.micros.length).toBeGreaterThan(0);
      expect(meso.days).toHaveLength(template.dayNames.length);
      meso.days.forEach((day) => {
        expect(day.length).toBeGreaterThanOrEqual(3);
        day.forEach((e) => {
          expect(e.sets).toBeGreaterThan(0);
          expect(e.reps).toBeGreaterThan(0);
          expect(e.rir).toBeGreaterThanOrEqual(0);
          if (e.repsMax !== undefined) expect(e.repsMax).toBeGreaterThan(e.reps);
        });
      });
    });
  });

  it.each(PROGRAM_TEMPLATES.map((t) => [t.name, t] as const))('%s builds a complete, consistent plan', (_, template) => {
    const payload = buildTemplatePlanPayload(template, {existingExercises: [], oneRepMaxFor: noOneRepMax});
    const {micros, trainings} = templateStructure(template);

    expect(Object.keys(payload.trainingsPlan.trainings)).toHaveLength(trainings);
    expect(payload.trainings).toHaveLength(trainings);
    // Every micro has every training of the template.
    for (let micro = 1; micro <= micros; micro++) {
      template.dayNames.forEach((_, day) => expect(payload.trainingsPlan.trainings[`${micro},${day + 1}`]).toBeDefined());
    }
    const workoutsById = new Map(payload.workouts.map((w) => [w.id, w]));
    const exerciseIds = new Set(payload.exercises.map((e) => e.id));
    payload.trainings.forEach((training) => {
      expect(training.state).toBe(TrainingsState.PLANNED);
      expect(training.doneWorkoutIds).toEqual({});
      expect(Object.keys(training.plannedWorkouts).map(Number)).toEqual([...training.exercises].sort((a, b) => a - b));
      training.exercises.forEach((exerciseId) => {
        expect(exerciseIds.has(exerciseId)).toBe(true);
        const workout = workoutsById.get(training.plannedWorkouts[exerciseId]);
        expect(workout?.exerciseId).toBe(exerciseId);
        expect(workout?.sets.length).toBeGreaterThan(0);
        workout?.sets.forEach((set) => {
          expect(set.reps).toBeGreaterThan(0);
          expect(set.rir).toBeGreaterThanOrEqual(0);
          expect(set.weight).toBe(0);
        });
      });
    });
    // No exercise is listed twice.
    expect(new Set(payload.exercises.map((e) => normalizeExerciseName(e.name))).size).toBe(payload.exercises.length);
  });

  it('describes the template structure', () => {
    const strength = PROGRAM_TEMPLATES.find((t) => t.id === 'strength-block')!;
    expect(templateStructure(strength)).toEqual({
      mesos: 2,
      micros: 8,
      trainingsPerMicro: 3,
      trainings: 24,
      exercises: [
        'Squat',
        'Bench Press',
        'Leg Curls',
        'Row',
        'Deadlift',
        'Overhead Press',
        'Lat Pulldown',
        'Hyperextensions',
        'Romanian Deadlift',
        'Facepulls',
      ],
    });
    expect(formatTemplateStructure(strength)).toBe('2 mesos · 8 micros · 3 trainings per micro');
  });

  it('suggests weights from a 1RM, rounded down to 2.5 kg, and leaves them empty without one', () => {
    // 100 / (1 + (5 + 3) / 30) = 78.9 → 77.5
    expect(suggestedWeight(100, 5, 3)).toBe(77.5);
    expect(suggestedWeight(0, 5, 3)).toBe(0);
  });

  it('ramps the RIR per micro and halves the sets in a deload', () => {
    const prescription = {exercise: 'Squat', sets: 3, reps: 8, repsMax: 10, rir: 3};
    expect(plannedSetsFor(prescription, {rirDelta: -2}, 0)).toEqual([
      {index: 1, reps: 8, repsMax: 10, rir: 1, weight: 0},
      {index: 2, reps: 8, repsMax: 10, rir: 1, weight: 0},
      {index: 3, reps: 8, repsMax: 10, rir: 1, weight: 0},
    ]);
    expect(plannedSetsFor(prescription, {rirDelta: -5}, 0)[0].rir).toBe(0);
    expect(plannedSetsFor(prescription, {rirDelta: 0, deload: true}, 0)).toEqual([
      {index: 1, reps: 8, repsMax: 10, rir: 5, weight: 0},
      {index: 2, reps: 8, repsMax: 10, rir: 5, weight: 0},
    ]);
  });

  it('reuses existing exercises by name and suggests their weights from the 1RM', () => {
    const template: ProgramTemplate = {
      id: 'mini',
      name: 'Mini',
      summary: '',
      description: 'A tiny template',
      dayNames: ['Day A'],
      mesos: [
        {
          name: 'Block',
          micros: [{rirDelta: 0}, {rirDelta: 0, deload: true}],
          days: [[{exercise: 'Squat', sets: 2, reps: 5, rir: 3}, {exercise: 'Romanian Deadlift', sets: 1, reps: 8, rir: 2}]],
        },
      ],
    };

    const payload = buildTemplatePlanPayload(template, {
      existingExercises: [{id: 7, name: ' squat ', muscles: [{muscle: Muscles.QUADS, percent: 100}]}],
      oneRepMaxFor: (exerciseId) => (exerciseId === 7 ? 100 : 0),
      planName: '  My block ',
    });

    expect(payload).toEqual({
      trainingsPlan: {
        name: 'My block',
        description: 'A tiny template',
        trainings: {'1,1': 1, '2,1': 2},
        trainingNames: {'1': 'Day A'},
        mesos: [{id: 1, name: 'Block', order: 1, startMicro: 1}],
      },
      trainings: [
        {id: 1, exercises: [1, 2], plannedWorkouts: {1: 1, 2: 2}, doneWorkoutIds: {}, state: TrainingsState.PLANNED},
        {id: 2, exercises: [1, 2], plannedWorkouts: {1: 3, 2: 4}, doneWorkoutIds: {}, state: TrainingsState.PLANNED},
      ],
      exercises: [
        // The user's own exercise keeps its name and muscles, so the import matches it.
        {id: 1, name: ' squat ', muscles: [{muscle: Muscles.QUADS, percent: 100}]},
        {
          id: 2,
          name: 'Romanian Deadlift',
          muscles: [
            {muscle: Muscles.HAMSTRINGS, percent: 100},
            {muscle: Muscles.GLUTES, percent: 70},
            {muscle: Muscles.BACK, percent: 30},
          ],
        },
      ],
      workouts: [
        {
          id: 1,
          exerciseId: 1,
          sets: [
            {index: 1, reps: 5, rir: 3, weight: 77.5},
            {index: 2, reps: 5, rir: 3, weight: 77.5},
          ],
        },
        {id: 2, exerciseId: 2, sets: [{index: 1, reps: 8, rir: 2, weight: 0}]},
        // Deload: 1 set at RIR 5 → 100 / (1 + 10/30) = 75
        {id: 3, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 5, weight: 75}]},
        {id: 4, exerciseId: 2, sets: [{index: 1, reps: 8, rir: 4, weight: 0}]},
      ],
    } satisfies TrainingsPlanExportPayload);
  });
});
