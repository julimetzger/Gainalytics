import {useExercisesForMuscles} from "../redux/Exercises/useExercisesForMuscles";
import DateRangePicker, {Range} from "./DateRangePicker";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import {Workout} from "../models/Workout";
import WorkoutSetOverview from "./WorkoutSetOverview";
import {Muscles} from "../models/Muscles";
import {Exercise} from "../models/Exercise";
import React from "react";

interface MetricNodeProps {
    range: Range,
    setRange: (range: Range) => void,
    muscle: Muscles[],
    exercise: Exercise[]
}

const MetricsNode = ({range, setRange, muscle, exercise}: MetricNodeProps) => {
    let exercisesForMuscles = useExercisesForMuscles(muscle);
    let exerciseIDs = exercise.map(it => it.id);
    let exercisesForMusclesIds = exercisesForMuscles.map(it => it.id);

    function getUniquewRokoutsIn(range: Range) {
        let allWorkouts = useWorkoutsIn(range);
        let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
        let workoutsForMuscles = allWorkouts.reverse().filter((workout: Workout) => exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : true) as Workout[];
        let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
        return Array.from(new Set(combinedWorkouts.map(workout => workout.id)))
            .map(id => combinedWorkouts.find(workout => workout.id === id)!!);
    }

    let uniqueWorkouts = getUniquewRokoutsIn(range);
    let previousUniqueWorkouts = getUniquewRokoutsIn(range.minusRange());

    return (
        <>
            <DateRangePicker range={range}
                             setRange={setRange}/>
            <WorkoutSetOverview trainingsWorkouts={uniqueWorkouts} previousWorkouts={previousUniqueWorkouts}/>
        </>
    )
}

export default MetricsNode;
