import React, {useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import WorkoutSetView from "../tabs/WorkoutSetView";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker from "../tabs/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate, getEndOfDay} from "../utils/DateHelper";
import ExercisePicker from "../tabs/ExercisePicker";
import useDispatchUpdateWorkoutSet from "../redux/Workout/useDispatchUpdateWorkoutSet";

function updateSetInWorkout(workout: Workout, workoutSet: WorkoutSet) {
    workout.sets = workout.sets.map(workoutSetFromDb => workoutSet.id === workoutSetFromDb.id ? workoutSet : workoutSetFromDb);
}

function deleteSetInWorkout(workout: Workout, workoutSet: WorkoutSet) {
    workout.sets = workout.sets.filter(value => value.id != workoutSet.id)
}

const History = () => {
    let now = new Date(Date.now());
    const [range, setRange] = useState({startDate: firstDayOfWeek(now, 1), endDate: getEndOfDay(now)})
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range).reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
    let lastExercises = lastWorkouts.map((workout: Workout) => workout.exerciseId);
    let exercises = new Map(useExerciseByIds(lastExercises).map((exercise: Exercise) => [exercise.id, exercise]));
    let useDispatchUpdateWorkoutSet1 = useDispatchUpdateWorkoutSet();
    const theme = useTheme();
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
                                useDispatchUpdateWorkoutSet1(workout);
                            }} onSubmit={(workoutSet) => {
                                updateSetInWorkout(workout, workoutSet);
                                useDispatchUpdateWorkoutSet1(workout);
                            }}/>
                        </View>
                    );
                })
            }
        </ScrollView>
    );
};

export default History;
