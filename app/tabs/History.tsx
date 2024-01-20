import React, {useEffect, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Button, Divider, IconButton, Text, useTheme} from 'react-native-paper';
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import WorkoutSetView from "../components/WorkoutSetView";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {dateComparator, firstDayOfWeek, getDateStringFromDate, getEndOfDay, subtractMonths} from "../utils/DateHelper";
import ExercisePicker from "../components/ExercisePicker";
import useDispatchUpdateWorkoutSet from "../redux/Workout/useDispatchUpdateWorkoutSet";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {repetitionMax} from "../utils/RepetitionMaxHelper";
import {RootStackParamList} from "../routing/HistoryRouter";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";

const History = ({route}: Props) => {
    useEffect(() => {
            if (route?.params?.exercise !== undefined) {
                setExercise([route.params.exercise]);
                setRange(new Range(route?.params?.lowerRangeBound ? subtractMonths(1, new Date(route.params.lowerRangeBound)) : subtractMonths(1), getEndOfDay()))
            }
        }, [route]
    )

    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), getEndOfDay(now)))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range)
        .filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true)
        .sort((a, b) => -dateComparator(a.start!!, b.start!!)) as Workout[];
    let lastExercises = lastWorkouts.map((workout: Workout) => workout.exerciseId);
    let exercises = new Map(useExerciseByIds(lastExercises).map((exercise: Exercise) => [exercise.id, exercise]));
    let dispatchUpdateWorkoutSet = useDispatchUpdateWorkoutSet();
    let useDeleteWorkoutdispatch = useDeleteWorkout();
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
                            <View style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start'}}>
                                <Text
                                    style={{fontSize: 20}}>{exercises.get(workout.exerciseId)?.name + " " + getDateStringFromDate(workout.start)}</Text>
                                <IconButton style={{margin: 0, alignSelf: 'flex-start', height: 30}} icon={"delete"}
                                            onPress={() => useDeleteWorkoutdispatch(workout)}/>
                            </View>
                            <WorkoutSetView sets={workout.sets} onDelete={(workoutSet) => {
                                deleteSetInWorkout(workout, workoutSet);
                                if (workout.sets.length === 0) {
                                    useDeleteWorkoutdispatch(workout);
                                } else {
                                    dispatchUpdateWorkoutSet(workout);
                                }
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
                <Text>1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap(value => value.sets)).toFixed(2) : 0} </Text>
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

export type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default History;
