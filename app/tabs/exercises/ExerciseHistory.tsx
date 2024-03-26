import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import WorkoutView from "../../components/WorkoutView";
import React, {useState} from "react";
import {useAllLastWorkouts} from "../../redux/Workout/useAllLastWorkouts";
import {ScrollView} from "react-native";

const ExerciseHistory = ({route}: Props) => {
    const [numberOfWorkouts, setNumberOfWorkouts] = useState(10)
    let workouts = useAllLastWorkouts(route.params.exercise, numberOfWorkouts);
    return (
        <ScrollView>
            <WorkoutView
                workoutIds={workouts.map(workout => workout.id).filter(workoutId => workoutId !== undefined) as number[]}
                onEndReached={() => setNumberOfWorkouts(numberOfWorkouts + 10)}/>
        </ScrollView>)
        ;
}

export type Props = NativeStackScreenProps<RootStackParamList, 'ExericseHistory'>;
export default ExerciseHistory;
