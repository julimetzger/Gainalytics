import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {GlobalState} from '../redux/rootReducer';
import {Training} from '../models/entities/Training';
import {Exercise} from '../models/entities/Exercise';
import {Workout} from '../models/entities/Workout';
import RNFS from 'react-native-fs';
import {TrainingsState} from '../models/TrainingsState';

export interface TrainingsPlanExportPayload {
  trainingsPlan: TrainingsPlan;
  trainings: Training[];
  exercises: Exercise[];
  workouts: Workout[];
}

export const buildTrainingsPlanExportPayload = (trainingsPlan: TrainingsPlan, state: GlobalState): TrainingsPlanExportPayload => {
  const exportTrainingsPlan = {...trainingsPlan};
  delete exportTrainingsPlan.lastTraining;
  const trainingIds = Object.values(trainingsPlan.trainings ?? {});
  const trainingSet = new Set<number>(trainingIds);
  const trainings = Array.from(trainingSet)
    .map((trainingId) => state.trainings.byId[trainingId])
    .filter((training): training is Training => training !== undefined && Object.keys(training.plannedWorkouts ?? {}).length > 0)
    .map((training) => {
      const plannedExerciseIds = Object.keys(training.plannedWorkouts ?? {}).map((id) => Number(id));
      return {
        ...training,
        exercises: plannedExerciseIds,
        doneWorkoutIds: {},
        state: TrainingsState.PLANNED,
        start: undefined,
        end: undefined,
      };
    });

  const workoutIds = new Set<number>();
  trainings.forEach((training) => {
    Object.values(training.plannedWorkouts ?? {}).forEach((workoutId) => workoutIds.add(workoutId));
  });

  const workouts = Array.from(workoutIds)
    .map((workoutId) => state.workouts.byId[workoutId])
    .filter((workout): workout is Workout => workout !== undefined)
    .map((workout) => ({
      ...workout,
      records: undefined,
    }));

  const exerciseIds = new Set<number>();
  trainings.forEach((training) => {
    training.exercises.forEach((exerciseId) => exerciseIds.add(exerciseId));
  });

  // A VL reference is calibrated from the owner's own filmed set, so it says nothing about
  // whoever imports the plan — drop it here (issue #316). The full `.gains` backup exports the
  // raw redux state and therefore keeps it.
  const exercises = Array.from(exerciseIds)
    .map((exerciseId) => state.exercises.byId[exerciseId])
    .filter((exercise): exercise is Exercise => exercise !== undefined)
    .map(({records: _records, vlReference: _vlReference, ...exercise}) => exercise);

  return {
    trainingsPlan: exportTrainingsPlan,
    trainings,
    exercises,
    workouts,
  };
};

export const exportTrainingsPlanToFile = async (trainingsPlan: TrainingsPlan, state: GlobalState) => {
  const payload = buildTrainingsPlanExportPayload(trainingsPlan, state);
  const fileName = `${trainingsPlan.name.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
  const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
  await RNFS.writeFile(path, JSON.stringify(payload, null, 2));
  return path;
};
