import DateRangePicker, {Range} from "./DateRangePicker";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import WorkoutView from "./WorkoutView";
import {Divider, Text} from "react-native-paper";
import {View} from "react-native";
import {repetitionMax} from "../utils/RepetitionMaxHelper";
import React, {memo} from "react";
import Picker from "./Picker";

interface HisotryNodeProps {
    range: Range,
    setRange: (range: Range) => void,
    exercise: Exercise[],
}

const HistoryNode = ({range, setRange, exercise}: HisotryNodeProps) => {
    let lastWorkouts = useWorkoutsIn(range)
        .filter((workout: Workout) => exercise.length > 0 ? exercise.map(it => it.id).includes(workout.exerciseId) : true)
    return <>
        <DateRangePicker range={range}
                         setRange={setRange}/>
        <WorkoutView
            workoutIds={lastWorkouts.map(workout => workout.id).filter(workoutId => workoutId !== undefined) as number[]}/>
        <Divider/>
        <View>
            <Text>Volume: {lastWorkouts.reduce<number>((previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0), 0)} kg</Text>
            <Text>1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap(value => value.sets)).toFixed(2) : 0} kg</Text>
        </View>
        <View style={{flex: 1}}></View>
    </>;
}

export default memo(HistoryNode, ((prevProps, nextProps) => {
    const b = prevProps.range.endDate.getTime() === nextProps.range.endDate.getTime() && nextProps.range.startDate.getTime() === prevProps.range.startDate.getTime();
    const b1 = prevProps.exercise.length === nextProps.exercise.length;
    return b && b1;
}))
