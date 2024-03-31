import React from "react";
import {View} from "react-native";
import WorkoutSetOverview from "./WorkoutSetOverview";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import {TrainingsPlan} from "../models/TrainingsPlan";
import {useAllTrainingsInMicro} from "../redux/Training/useAllTrainingsInMicro";

interface PlanningOverviewProps {
    trainingsPlan: TrainingsPlan,
    micro: number
}

const PlanningOverview = ({trainingsPlan, micro}: PlanningOverviewProps) => {
    let trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
    let map = trainings.flatMap(training => training?.plannedWorkouts ? Object.values(training.plannedWorkouts) : []);
    let workouts = useWorkoutsByIds(map);

    return (
        <View>
            <WorkoutSetOverview trainingsWorkouts={workouts} showExercises={false}/>
        </View>
    )
}

export default PlanningOverview;