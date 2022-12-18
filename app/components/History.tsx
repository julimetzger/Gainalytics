import React, {useEffect, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Divider, Text, useTheme} from 'react-native-paper';
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import WorkoutSetView from "../tabs/WorkoutSetView";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker from "../tabs/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate, getEndOfDay, subtractMonths} from "../utils/DateHelper";
import ExercisePicker from "../tabs/ExercisePicker";
import useDispatchUpdateWorkoutSet from "../redux/Workout/useDispatchUpdateWorkoutSet";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../routing/exerciseRouter";
import {repetitionMax} from "../utils/RepetitionMaxHelper";

const History = ({route}: Props) => {
    useEffect(() => {
            if (route?.params?.exercise !== undefined) {
                setExercise([route.params.exercise]);
                setRange({startDate: subtractMonths(1), endDate: getEndOfDay()})
            }
        }, [route]
    )

    let now = new Date(Date.now());
    const [range, setRange] = useState({startDate: firstDayOfWeek(now, 1), endDate: getEndOfDay(now)})
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range).reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
    let lastExercises = lastWorkouts.map((workout: Workout) => workout.exerciseId);
    let exercises = new Map(useExerciseByIds(lastExercises).map((exercise: Exercise) => [exercise.id, exercise]));
    let dispatchUpdateWorkoutSet = useDispatchUpdateWorkoutSet();
    const theme = useTheme();
    // @ts-ignore
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}}>
            <DateRangePicker range={range} setRange={setRange}/>
            <ExercisePicker exercise={exercise} setExercise={setExercise}/>
            {
                lastWorkouts.map((workout) => {
                    return (
                        <View>
                            <Text
                                style={{fontSize: 20}}>{exercises.get(workout.exerciseId)?.name + " " + getDateStringFromDate(workout.end)}</Text>
                            <WorkoutSetView sets={workout.sets} onDelete={(workoutSet) => {
                                deleteSetInWorkout(workout, workoutSet);
                                dispatchUpdateWorkoutSet(workout);
                            }} onSubmit={(workoutSet) => {
                                updateSetInWorkout(workout, workoutSet);
                                dispatchUpdateWorkoutSet(workout);
                            }}/>
                        </View>
                    );
                })
            }
            <Divider/>
            <View>
                <Text>Volume: {lastWorkouts.reduce<number>((previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0), 0)}</Text>
                <Text>1RM: {repetitionMax(...lastWorkouts.flatMap(value => value.sets))} </Text>
            </View>
        </ScrollView>
    );
};


function updateSetInWorkout(workout: Workout, workoutSet: WorkoutSet) {
    workout.sets = workout.sets.map(workoutSetFromDb => workoutSet.index === workoutSetFromDb.index ? workoutSet : workoutSetFromDb);
}

function deleteSetInWorkout(workout: Workout, workoutSet: WorkoutSet) {
    workout.sets = workout.sets.filter(value => value.index != workoutSet.index)
}

export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default History;
