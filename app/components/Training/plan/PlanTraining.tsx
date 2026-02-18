import {View} from 'react-native';
import AddWorkoutSet from '../../Workout/add/AddWorkoutSet';
import React from 'react';
import {dispatchAddPlanedTrainingWorkout} from '../../../redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {usePlannedWorkoutInTraining} from '../../../redux/Training/use/usePlannedWorkoutInTraining';
import {useAllLastWorkouts} from '../../../redux/Workout/use/useAllLastWorkouts';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {useNextTrainingsId} from '../../../redux/Training/use/useNextTrainingsId';
import {Training} from '../../../models/entities/Training';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';

const PlanTraining = ({training, trainingsPlanId, micro, trainingInMicro, chosenExercise}: Props) => {
  const addPlanedTrainingWorkoutSet = dispatchAddPlanedTrainingWorkout();
  let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(chosenExercise, true);
  let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  const plannedWorkout = usePlannedWorkoutInTraining(training?.id, chosenExercise.id);
  let workouts = useAllLastWorkouts(chosenExercise, 1);
  let oneRepMax = oneRepMaxForWorkouts(...workouts);
  let number = useNextTrainingsId();

  function submitPlannedWorkoutSet(workoutSet: WorkoutSet) {
    if (plannedWorkout === undefined || plannedWorkout.id === undefined) {
      addPlanedTrainingWorkoutSet(
        trainingsPlanId,
        micro,
        trainingInMicro,
        chosenExercise.id!!,
        {
          sets: [{...workoutSet, index: workoutSet.index ?? 1}],
          notes: '',
          exerciseId: chosenExercise.id!!,
          start: new Date(Date.now()),
          trainingsId: training?.id ?? number,
        },
        training?.id,
      );
      return;
    }
    addOrUpdateSetInWorkout(workoutSet, plannedWorkout);
  }

  return (
    <View>
      <AddWorkoutSet onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)} oneRepMax={oneRepMax} isPlanningMode={false} />
      {plannedWorkout?.sets.map((workoutSet) => {
        return (
          <AddWorkoutSet
            workoutSet={workoutSet}
            key={workoutSet.index ?? '' + workoutSet.reps + workoutSet.weight + workoutSet.date?.getTime()}
            onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)}
            onDelete={() => deleteSetFromWorkout(workoutSet, plannedWorkout)}
            isPlanningMode={false}
          />
        );
      })}
    </View>
  );
};
export default PlanTraining;

interface Props {
  training: Training;
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  chosenExercise: Exercise;
}
