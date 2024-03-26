import React, {memo} from "react";
import {StyleSheet, View} from "react-native";
import {Card, Text, useTheme} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import WorkoutViewTile from "./WorkoutViewTile";
import {Metric} from "./Picker";
import {FlashList} from "@shopify/flash-list";
import {useDateWorkoutMapByIds} from "../redux/Workout/useDateWorkoutMapByIds";
import {useHighlightWorkout} from "../redux/Workout/useHighlightWorkout";

interface WorkoutViewProps {
    workoutIds: number[],
    highlightMode?: Metric,
    editable?: boolean
    onEndReached?: () => void
}

const style1 = {marginBottom: 10, marginHorizontal: 5};

const style = {minHeight: 20};
const WorkoutView = ({workoutIds, highlightMode, editable = true, onEndReached}: WorkoutViewProps) => {
    let theme = useTheme();
    let dateWorkoutMap = useDateWorkoutMapByIds(workoutIds);
    let highlightWorkout = useHighlightWorkout(workoutIds, highlightMode);
    const styles = StyleSheet.create({
        exerciseText: {
            fontSize: theme.fonts.titleLarge.fontSize,
            marginLeft: 5,
        },
    });

    return (<View style={style}>
        <FlashList onEndReached={onEndReached} scrollEnabled={false} data={Array.from(dateWorkoutMap.entries())} estimatedItemSize={250}
                   keyboardShouldPersistTaps={'always'}
                   renderItem={({item: [date, workouts]}) => {
                       return (
                           <Card mode={'contained'} style={style1}
                                 key={new Date(date).getTime()}>
                               <Text style={styles.exerciseText}>
                                   {getDateStringFromDate(new Date(date))}</Text>
                               {workouts.map((workout) => {
                                   return <WorkoutViewTile workoutId={workout}
                                                           key={workout}
                                                           highlightMode={highlightWorkout.includes(workout!!) ? highlightMode : undefined}
                                                           editable={editable}/>;
                               })}
                           </Card>
                       )
                   }}
        />
    </View>)

}


// @ts-ignore
export default memo(WorkoutView, ((prevProps, nextProps) => {
    if (nextProps.highlightMode)
        return false;
    return prevProps.workoutIds.every(id => nextProps.workoutIds.includes(id)) &&
        nextProps.workoutIds.every(id => prevProps.workoutIds.includes(id));
}));
