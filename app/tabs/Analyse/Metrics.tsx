import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import React, {useState} from "react";
import {ScrollView} from "react-native";
import WorkoutSetOverview from "../../components/WorkoutSetOverview";
import Picker from "../../components/Picker";
import DateRangePicker, {Range} from "../../components/DateRangePicker";
import {firstDayOfWeek, lastDayOfWeek} from "../../utils/DateHelper";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import {useExercisesForMuscles} from "../../redux/Exercises/useExercisesForMuscles";
import {useWorkoutsIn} from "../../redux/Workout/useWorkoutsIn";
import {Workout} from "../../models/Workout";

const MetricsTab = () => {
    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);
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
        <ScrollView>
            <Picker exercise={exercise} setExercise={setExercise}
                    muscle={muscle} setMuscle={setMuscle}/>
            <DateRangePicker range={range} setRange={setRange}/>
            <WorkoutSetOverview trainingsWorkouts={uniqueWorkouts} previousWorkouts={previousUniqueWorkouts}/>
        </ScrollView>
    )
}

export default MetricsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Metrics'>;
