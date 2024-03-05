import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {Divider, Text} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {firstDayOfWeek, getEndOfDay, lastDayOfWeek, subtractMonths} from "../utils/DateHelper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import Animated, {runOnJS, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView, ScrollView} from 'react-native-gesture-handler';
import {RootStackParamList} from "../routing/AnalyseRouter";
import Picker from "../components/Picker";
import WorkoutView from "../components/WorkoutView";
import {repetitionMax} from "../utils/RepetitionMaxHelper";


function getScrollView(range: Range, exercise: Exercise[]) {
    let lastWorkouts = useWorkoutsIn(range)
        .filter((workout: Workout) => exercise.length > 0 ? exercise.map(it => it.id).includes(workout.exerciseId) : true)
    return <>
        <WorkoutView
            workoutIds={lastWorkouts.map(workout => workout.id).filter(workoutId => workoutId !== undefined) as number[]}/>
        <Divider/>
        <View>
            <Text>Volume: {lastWorkouts.reduce<number>((previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0), 0)}</Text>
            <Text>1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap(value => value.sets)).toFixed(2) : 0} </Text>
        </View>
    </>;
}

interface PositionRange {
    position: number,
    range: Range
}

interface FullPosition {
    Upper: PositionRange,
    Lower: PositionRange,
    Middle: PositionRange,
    activeView: ViewPosition,
    index: number
}

enum ViewPosition {
    UPPER,
    MIDDLE,
    LOWER
}

const History = ({route}: Props) => {
        useEffect(() => {
                if (route?.params?.exercise !== undefined) {
                    setExercise([route.params.exercise]);
                    setRange(new Range(route?.params?.lowerRangeBound ? subtractMonths(1, new Date(route.params.lowerRangeBound)) : subtractMonths(1), getEndOfDay()))
                }
            }, [route]
        )
        let now = new Date(Date.now());
        const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)))
        const [fullPosition, setFullPosition] = useState({
            Upper: {position: -1, range: range.minusRange()},
            Middle: {position: 0, range: range},
            Lower: {position: 1, range: range.plusOneRange()},
            activeView: ViewPosition.MIDDLE,
            index: 0
        } as FullPosition)
        const [exercise, setExercise] = useState<Exercise[]>([]);
        let dimensions = useWindowDimensions();

        const xPosition = useSharedValue(0);
        const yPosition = useSharedValue(0);
        console.log("fullPosition", fullPosition)

        function uiinusOne() {
            let newRange = range.minusRange()
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: newRange.plusOneRange()},
                    Lower: {position: -1, range: newRange.minusRange()},
                    index: fullPosition.index - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: newRange.minusRange()},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: newRange.plusOneRange()},
                    index: fullPosition.index - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: newRange.plusOneRange()},
                    Middle: {position: -1, range: newRange.minusRange()},
                    Lower: {position: 0, range: newRange},
                    index: fullPosition.index - 1
                })
            }
            setRange(newRange)
        }

        useEffect(() => {
        }, [range]);


        function uiplusOne() {
            let newRange = range.plusOneRange()
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: newRange.plusOneRange()},
                    Middle: {position: -1, range: newRange.minusRange()},
                    Lower: {position: 0, range: newRange},
                    index: fullPosition.index + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: newRange.plusOneRange()},
                    Lower: {position: -1, range: newRange.minusRange()},
                    index: fullPosition.index + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: newRange.minusRange()},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: newRange.plusOneRange()},
                    index: fullPosition.index + 1
                })
            }
            setRange(newRange)
        }

        const initialTouchLocation = useSharedValue<{ x: number, y: number } | null>(null);

        const refa = useRef();

        const panGesture = Gesture.Pan()
            /* .onStart((e) => {
             })
             .manualActivation(true)
             .onBegin((evt) => {
                 initialTouchLocation.value = {x: evt.x, y: evt.y};
             })
             .onTouchesMove((evt, state) => {
                 // Sanity checks
                 if (!initialTouchLocation.value || !evt.changedTouches.length) {
                     state.fail();
                     return;
                 }

                 const xDiff = Math.abs(evt.changedTouches[0].x - initialTouchLocation.value.x);
                 const yDiff = Math.abs(evt.changedTouches[0].y - initialTouchLocation.value.y);
                 const isHorizontalPanning = xDiff > yDiff;

                 if (isHorizontalPanning) {
                     state.activate();
                 } else {
                     state.fail();
                 }
             })*/
            .onUpdate((e) => {
                console.log("update tranlation", e.translationX)
                console.log("update positio", xPosition.value / dimensions.width)
                xPosition.value = -fullPosition.index * dimensions.width + e.translationX;
                yPosition.value = e.translationY;
            })
            .onEnd((e) => {
                    console.log("end", xPosition.value / dimensions.width)
                    console.log(e.translationX / dimensions.width)
                    if (xPosition.value > dimensions.width / SNAP_POINT + -fullPosition.index * dimensions.width) {
                        xPosition.value = withTiming((-fullPosition.index + 1) * dimensions.width, {duration: 100});
                        console.log("plus end", xPosition.value / dimensions.width)
                        runOnJS(uiinusOne)();
                    }
                    if (xPosition.value < -dimensions.width / SNAP_POINT + -fullPosition.index * dimensions.width) {
                        xPosition.value = withTiming((-fullPosition.index - 1) * dimensions.width, {duration: 100});
                        console.log("minus end", xPosition.value / dimensions.width)
                        runOnJS(uiplusOne)();
                    }
                    if (xPosition.value < dimensions.width / SNAP_POINT - fullPosition.index * dimensions.width && +xPosition.value > -dimensions.width / SNAP_POINT - fullPosition.index * dimensions.width) {
                        console.log("upper", xPosition.value / dimensions.width)
                        console.log("end", xPosition.value / dimensions.width)
                        xPosition.value = -fullPosition.index * dimensions.width;
                    }
                    yPosition.value = yPosition.value + e.translationY;
                }
            ).withRef(refa)
        ;

        const determineRange = (index: number) => {
            if (index === 0) {
                return range
            }
            if (index === 1) {
                return range.plusOneRange()
            }
            if (index === -1) {
                return range.minusRange()
            }
            return range
        }


        const animatedStyle = useAnimatedStyle(() => ({
            transform: [
                {translateX: xPosition.value},
                {translateY: yPosition.value}
            ]
        }));
        return (
            <GestureHandlerRootView>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[animatedStyle]}>
                        <ScrollView simultaneousHandlers={refa} key={1} style={{
                            width: dimensions.width,
                            top: 0,
                            position: "absolute",
                            backgroundColor: "red",
                            left: (fullPosition.Upper.position + fullPosition.index) * dimensions.width,
                        }}
                        >
                            <DateRangePicker range={determineRange(fullPosition.Upper.position)}
                                             setRange={setRange}/>
                            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                            {getScrollView(determineRange(fullPosition.Upper.position), exercise)}
                        </ScrollView>
                        <ScrollView key={2} simultaneousHandlers={refa} style={{
                            width: dimensions.width,
                            top: 0,
                            backgroundColor: "green",
                            position: "absolute",
                            left: (fullPosition.Middle.position + fullPosition.index) * dimensions.width,
                        }}>
                            <DateRangePicker range={determineRange(fullPosition.Middle.position)}
                                             setRange={setRange}/>
                            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                            {getScrollView(determineRange(fullPosition.Middle.position), exercise)}
                        </ScrollView>
                        <ScrollView key={3} simultaneousHandlers={refa} style={{
                            width: dimensions.width,
                            top: 0,
                            backgroundColor: "blue",
                            position: "absolute",
                            left: (fullPosition.Lower.position + fullPosition.index) * dimensions.width,
                        }}>
                            <DateRangePicker range={determineRange(fullPosition.Lower.position)}
                                             setRange={setRange}/>
                            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                            {getScrollView(determineRange(fullPosition.Lower.position), exercise)}
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        )
    }
;
const SNAP_POINT = 3;

export type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default History;




