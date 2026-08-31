import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {Muscles} from '../../models/Muscles';
import {Exercise, ExerciseRecord, VelocityLossReference} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';

const initialState = {
  byId: {
    1: {
      id: 1,
      name: 'Bench Press',
      muscles: [
        {muscle: Muscles.CHEST, percent: 100},
        {muscle: Muscles.TRICEPS, percent: 70},
        {muscle: Muscles.SHOULDERS, percent: 10},
      ],
    },
    2: {
      id: 2,
      name: 'Squat',
      muscles: [
        {muscle: Muscles.GLUTES, percent: 100},
        {muscle: Muscles.QUADS, percent: 100},
        {muscle: Muscles.HAMSTRINGS, percent: 50},
        {muscle: Muscles.CORE, percent: 30},
        {muscle: Muscles.BACK, percent: 20},
      ],
    },
    3: {
      id: 3,
      name: 'Deadlift',
      muscles: [
        {muscle: Muscles.BACK, percent: 50},
        {muscle: Muscles.HAMSTRINGS, percent: 50},
        {muscle: Muscles.GLUTES, percent: 50},
        {muscle: Muscles.QUADS, percent: 30},
        {muscle: Muscles.CORE, percent: 30},
      ],
    },
    4: {
      id: 4,
      name: 'Overhead Press',
      muscles: [
        {muscle: Muscles.SHOULDERS, percent: 100},
        {muscle: Muscles.TRICEPS, percent: 50},
      ],
    },
    5: {
      id: 5,
      name: 'Cable Pushdowns',
      muscles: [{muscle: Muscles.TRICEPS, percent: 100}],
    },
    6: {
      id: 6,
      name: 'Dips',
      muscles: [
        {muscle: Muscles.TRICEPS, percent: 100},
        {muscle: Muscles.CHEST, percent: 80},
      ],
    },
    7: {
      id: 7,
      name: 'Butterfly',
      muscles: [
        {muscle: Muscles.CHEST, percent: 100},
        {muscle: Muscles.SHOULDERS, percent: 10},
      ],
    },
    8: {
      id: 8,
      name: 'Pull-Up',
      muscles: [
        {muscle: Muscles.BACK, percent: 100},
        {muscle: Muscles.BICEPS, percent: 80},
      ],
    },
    9: {
      id: 9,
      name: 'Biceps Curls',
      muscles: [{muscle: Muscles.BICEPS, percent: 100}],
    },
    10: {
      id: 10,
      name: 'Cable Curls',
      muscles: [{muscle: Muscles.BICEPS, percent: 100}],
    },
    11: {
      id: 11,
      name: 'Facepulls',
      muscles: [
        {muscle: Muscles.SHOULDERS, percent: 100},
        {muscle: Muscles.BACK, percent: 20},
      ],
    },
    12: {
      id: 12,
      name: 'Reverse Flys',
      muscles: [
        {muscle: Muscles.SHOULDERS, percent: 100},
        {muscle: Muscles.BACK, percent: 20},
      ],
    },
    13: {
      id: 13,
      name: 'Lateral Raise',
      muscles: [{muscle: Muscles.SHOULDERS, percent: 100}],
    },
    14: {
      id: 14,
      name: 'Leg Press',
      muscles: [
        {muscle: Muscles.GLUTES, percent: 100},
        {muscle: Muscles.QUADS, percent: 100},
        {muscle: Muscles.HAMSTRINGS, percent: 20},
      ],
    },
    15: {
      id: 15,
      name: 'Leg Curls',
      muscles: [{muscle: Muscles.HAMSTRINGS, percent: 100}],
    },
    16: {
      id: 16,
      name: 'Leg Extensions',
      muscles: [{muscle: Muscles.HAMSTRINGS, percent: 100}],
    },
    17: {
      id: 17,
      name: 'Hip Adduction',
      muscles: [{muscle: Muscles.HAMSTRINGS, percent: 10}],
    },
    18: {
      id: 18,
      name: 'Hip Abduction',
      muscles: [{muscle: Muscles.GLUTES, percent: 50}],
    },
    19: {
      id: 19,
      name: 'Hyperextensions',
      muscles: [
        {muscle: Muscles.GLUTES, percent: 100},
        {muscle: Muscles.HAMSTRINGS, percent: 50},
        {muscle: Muscles.BACK, percent: 10},
      ],
    },
    20: {
      id: 20,
      name: 'Hip Thrusts',
      muscles: [
        {muscle: Muscles.GLUTES, percent: 100},
        {muscle: Muscles.HAMSTRINGS, percent: 50},
      ],
    },
    21: {
      id: 21,
      name: 'Row',
      muscles: [
        {muscle: Muscles.BACK, percent: 100},
        {muscle: Muscles.BICEPS, percent: 50},
      ],
    },
    22: {
      id: 22,
      name: 'Lat Pulldown',
      muscles: [
        {muscle: Muscles.BACK, percent: 100},
        {muscle: Muscles.BICEPS, percent: 80},
      ],
    },
  },
  allIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
} as NormalizedState<Exercise>;

function sanitizeAlternativeIds(exercises: NormalizedState<Exercise>, exerciseId: number, alternativeIds?: number[]) {
  const seen = new Set<number>();
  return (alternativeIds ?? []).filter((alternativeId) => {
    if (alternativeId === exerciseId || exercises.byId[alternativeId] === undefined || seen.has(alternativeId)) {
      return false;
    }
    seen.add(alternativeId);
    return true;
  });
}

function normalizeAlternativeIds(alternativeIds?: number[]) {
  return alternativeIds && alternativeIds.length > 0 ? alternativeIds : undefined;
}

function upsertBidirectionalAlternatives(
  exercises: NormalizedState<Exercise>,
  exerciseId: number,
  alternativeIds?: number[],
  previousAlternativeIds?: number[],
) {
  const exercise = exercises.byId[exerciseId];
  if (exercise === undefined) {
    return exercises;
  }

  const sanitizedAlternativeIds = sanitizeAlternativeIds(exercises, exerciseId, alternativeIds);
  const affectedExerciseIds = new Set<number>([exerciseId, ...(previousAlternativeIds ?? exercise.alternativeIds ?? []), ...sanitizedAlternativeIds]);
  const byId = {...exercises.byId};

  byId[exerciseId] = {
    ...exercise,
    alternativeIds: normalizeAlternativeIds(sanitizedAlternativeIds),
  };

  affectedExerciseIds.forEach((affectedExerciseId) => {
    if (affectedExerciseId === exerciseId) {
      return;
    }
    const affectedExercise = exercises.byId[affectedExerciseId];
    if (affectedExercise === undefined) {
      return;
    }

    const nextAlternativeIds = (affectedExercise.alternativeIds ?? []).filter((value) => value !== exerciseId);
    if (sanitizedAlternativeIds.includes(affectedExerciseId)) {
      nextAlternativeIds.push(exerciseId);
    }

    byId[affectedExerciseId] = {
      ...affectedExercise,
      alternativeIds: normalizeAlternativeIds([...new Set(nextAlternativeIds)]),
    };
  });

  return {
    ...exercises,
    byId,
  };
}

function removeExerciseFromAlternatives(exercises: NormalizedState<Exercise>, exerciseId: number) {
  const byId = Object.fromEntries(
    Object.entries(exercises.byId)
      .filter(([currentExerciseId]) => parseInt(currentExerciseId) !== exerciseId)
      .map(([currentExerciseId, exercise]) => {
        const nextAlternativeIds = (exercise.alternativeIds ?? []).filter((value) => value !== exerciseId);
        return [
          currentExerciseId,
          {
            ...exercise,
            alternativeIds: normalizeAlternativeIds(nextAlternativeIds),
          },
        ];
      }),
  ) as {[exerciseId: number]: Exercise};

  return {
    byId,
    allIds: exercises.allIds.filter((id) => id !== exerciseId),
  };
}

function moveWorkoutRecords(exercises: NormalizedState<Exercise>, fromExerciseId: number, toExerciseId: number, workout?: Workout) {
  if (workout?.id === undefined || workout.records === undefined) {
    return exercises;
  }

  const fromExercise = exercises.byId[fromExerciseId];
  const toExercise = exercises.byId[toExerciseId];
  if (fromExercise === undefined || toExercise === undefined) {
    return exercises;
  }

  const fromRecords = {...fromExercise.records};
  const toRecords = {...toExercise.records};

  Object.entries(workout.records).forEach(([recordName, value]) => {
    const nextFromValues = (fromRecords?.[recordName] ?? []).filter((record) => record.workoutId !== workout.id);
    if (nextFromValues.length > 0) {
      fromRecords[recordName] = nextFromValues;
    } else if (fromRecords) {
      delete fromRecords[recordName];
    }

    toRecords[recordName] = [
      ...(toRecords?.[recordName] ?? []).filter((record) => record.workoutId !== workout.id),
      {
        value,
        workoutId: workout.id,
      },
    ] as ExerciseRecord[];
  });

  return {
    ...exercises,
    byId: {
      ...exercises.byId,
      [fromExerciseId]: {
        ...fromExercise,
        records: Object.keys(fromRecords ?? {}).length > 0 ? fromRecords : undefined,
      },
      [toExerciseId]: {
        ...toExercise,
        records: toRecords,
      },
    },
  };
}

const exerciseReducer = (exercises: NormalizedState<Exercise> = initialState, action: AnyAction) => {
  switch (action.type) {
    case 'ADD_EXERCISE': {
      const newId = Math.max(...exercises.allIds) + 1;
      const nextState = {
        byId: {
          ...exercises.byId,
          [newId]: {
            id: newId,
            name: action.nameOfExercise,
            isFocus: action.isFocus ?? false,
            muscles: action.muscles,
            alternativeIds: normalizeAlternativeIds(action.alternativeIds),
          } as Exercise,
        },
        allIds: [...exercises.allIds, newId],
      };
      return upsertBidirectionalAlternatives(nextState, newId, action.alternativeIds);
    }
    case 'DELETE_EXERCISE': {
      return removeExerciseFromAlternatives(exercises, action.exerciseId);
    }
    case 'EDIT_EXERCISE': {
      const nextState = {
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...exercises.byId[action.exerciseId],
            name: action.nameOfExercise,
            isFocus: action.isFocus ?? exercises.byId[action.exerciseId]?.isFocus ?? false,
            muscles: action.muscles,
            alternativeIds: normalizeAlternativeIds(action.alternativeIds),
          },
        },
        allIds: [...exercises.allIds],
      };
      return upsertBidirectionalAlternatives(nextState, action.exerciseId, action.alternativeIds, exercises.byId[action.exerciseId]?.alternativeIds);
    }
    case 'SET_EXERCISE_VL_REFERENCE': {
      const exercise = exercises.byId[action.exerciseId];
      if (exercise === undefined) return exercises;
      // One active reference per exercise — assigning simply replaces the previous one.
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...exercise,
            vlReference: action.vlReference as VelocityLossReference,
          },
        },
      };
    }
    case 'CLEAR_EXERCISE_VL_REFERENCE': {
      const exercise = exercises.byId[action.exerciseId];
      if (exercise === undefined || exercise.vlReference === undefined) return exercises;
      const {vlReference: _removed, ...withoutReference} = exercise;
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: withoutReference,
        },
      };
    }
    case 'TOGGLE_FOCUS_EXERCISE': {
      const exercise = exercises.byId[action.exerciseId];
      if (exercise === undefined) return exercises;
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...exercise,
            isFocus: !exercise.isFocus,
          },
        },
      };
    }
    case 'REPLACE_EXERCISE_IN_TRAINING': {
      return moveWorkoutRecords(exercises, action.fromExerciseId, action.toExerciseId, action.doneWorkout);
    }
    case 'ADD_RECORD': {
      let recordExercise = {...exercises.byId[action.exerciseId]};
      if (recordExercise.records === undefined) recordExercise.records = {[action.record]: []};
      recordExercise.records[action.record].push({value: action.value.toFixed(2), workoutId: action.workoutId});
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...recordExercise,
            records: {...recordExercise.records},
          },
        },
      };
    }
    case 'UPDATE_RECORD': {
      let recordExercise = {...exercises.byId[action.exerciseId]};
      if (recordExercise.records === undefined) recordExercise.records = {[action.record]: []};
      recordExercise.records[action.record].find((record) => record.workoutId === action.workoutId)!.value = action.value.toFixed(2);
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...recordExercise,
            records: {...recordExercise.records},
          },
        },
      };
    }
    case 'DELETE_RECORD': {
      let recordExercise = {...exercises.byId[action.exerciseId]};
      if (recordExercise.records === undefined) recordExercise.records = {[action.record]: []};
      recordExercise.records[action.record] = recordExercise.records[action.record].filter((record) => record.workoutId !== action.workoutId);
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [action.exerciseId]: {
            ...recordExercise,
            records: {...recordExercise.records},
          },
        },
      };
    }
    case 'DELETE_WORKOUT': {
      let workout = action.workout;
      let exerciseForWorkout = {...exercises.byId[workout.exerciseId]};
      exerciseForWorkout.records = exerciseForWorkout.records
        ? Object.entries(exerciseForWorkout.records)
            .map(([key, value]) => [key, value.filter((record) => record.workoutId !== workout.id)])
            .reduce(
              (obj, [key, value]) => ({
                ...obj,
                [key as string]: value as ExerciseRecord[],
              }),
              {},
            )
        : undefined;
      return {
        ...exercises,
        byId: {
          ...exercises.byId,
          [workout.exerciseId]: exerciseForWorkout,
        },
      };
    }
    case 'DELETE_TRAINING': {
      const workoutIds = new Set<number>(action.workoutIds ?? []);
      if (workoutIds.size === 0) return exercises;
      const byId = Object.entries(exercises.byId).reduce(
        (mappedExercises, [exerciseId, exercise]) => {
          if (exercise.records === undefined) {
            return {
              ...mappedExercises,
              [exerciseId]: exercise,
            };
          }
          const records = Object.entries(exercise.records).reduce(
            (mappedRecords, [recordName, values]) => ({
              ...mappedRecords,
              [recordName]: values.filter((value) => !workoutIds.has(value.workoutId)),
            }),
            {},
          );
          return {
            ...mappedExercises,
            [exerciseId]: {
              ...exercise,
              records,
            },
          };
        },
        {},
      );
      return {
        ...exercises,
        byId,
      };
    }
    default:
      return exercises;
  }
};
export default exerciseReducer;
