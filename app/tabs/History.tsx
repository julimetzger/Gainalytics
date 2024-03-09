import React, {useEffect, useRef, useState} from 'react';
import {useWindowDimensions, View} from 'react-native';
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
            <Text>Volume: {lastWorkouts.reduce<number>((previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0), 0)} kg</Text>
            <Text>1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap(value => value.sets)).toFixed(2) : 0} kg</Text>
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
    range: Range,
    traveledIndex: number
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
        const [fullPosition, setFullPosition] = useState({
            Upper: {position: -1, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)).minusRange()},
            Middle: {position: 0, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0))},
            Lower: {position: 1, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)).plusOneRange()},
            activeView: ViewPosition.MIDDLE,
            range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)),
            traveledIndex: 0
        } as FullPosition)
        const [exercise, setExercise] = useState<Exercise[]>([]);
        let dimensions = useWindowDimensions();

        let initialOffset = -dimensions.width;
        const xPosition = useSharedValue(0);
        const yPosition = useSharedValue(0);

        function uiinusOne() {
            let newRange = fullPosition.range.minusRange()
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: newRange.plusOneRange()},
                    Lower: {position: -1, range: newRange.minusRange()},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: newRange.minusRange()},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: newRange.plusOneRange()},
                    range: newRange, traveledIndex: fullPosition.traveledIndex + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: newRange.plusOneRange()},
                    Middle: {position: -1, range: newRange.minusRange()},
                    Lower: {position: 0, range: newRange},
                    range: newRange, traveledIndex: fullPosition.traveledIndex + 1
                })
            }
        }

        function uiplusOne() {
            let newRange = fullPosition.range.plusOneRange()
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: newRange.plusOneRange()},
                    Middle: {position: -1, range: newRange.minusRange()},
                    Lower: {position: 0, range: newRange},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: newRange.plusOneRange()},
                    Lower: {position: -1, range: newRange.minusRange()},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: newRange.minusRange()},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: newRange.plusOneRange()},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex - 1
                })
            }
        }

        const zeroPositon = fullPosition.traveledIndex * dimensions.width;

        const refa = useRef();

        const initialTouchLocation = useSharedValue<{ x: number, y: number } | null>(null);

        const panGesture = Gesture.Pan()
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
                const isHorizontalPanning = xDiff > yDiff && xDiff > 30;

                if (isHorizontalPanning) {
                    state.activate();
                }
            })
            .onUpdate((e) => {
                xPosition.value = zeroPositon + e.translationX;
            })
            .onEnd((e) => {

                    if (xPosition.value > dimensions.width / SNAP_POINT + zeroPositon) {
                        runOnJS(uiinusOne)();
                        xPosition.value = withTiming(zeroPositon + dimensions.width, {duration: 100});
                    }
                    if (xPosition.value < -dimensions.width / SNAP_POINT + zeroPositon) {
                        runOnJS(uiplusOne)();
                        xPosition.value = withTiming(zeroPositon - dimensions.width, {duration: 100});
                        console.log("minus position", xPosition.value)
                    }
                    if (xPosition.value < dimensions.width / SNAP_POINT + zeroPositon && +xPosition.value > -dimensions.width / SNAP_POINT + zeroPositon) {
                        xPosition.value = zeroPositon;
                    }
                    yPosition.value = yPosition.value + e.translationY;
                }
            ).withRef(refa)
        ;

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [
                {translateX: xPosition.value}
            ]
        }));

        const determineRange = (index: number, range: Range) => {
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
        console.log("position", xPosition.value)
        console.log("left", zeroPositon + initialOffset)
        console.log("zeroPoint", zeroPositon);

        function setRange(range: Range) {
            setFullPosition({
                activeView: fullPosition.activeView,
                Upper: {...fullPosition.Upper, range: determineRange(fullPosition.Upper.position, range)},
                Middle: {...fullPosition.Middle, range: determineRange(fullPosition.Middle.position, range)},
                Lower: {...fullPosition.Lower, range: determineRange(fullPosition.Lower.position, range)},
                range: range,
                traveledIndex: fullPosition.traveledIndex
            })
        }

        return (
            <GestureHandlerRootView>
                <ScrollView simultaneousHandlers={refa}>
                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[animatedStyle, {
                            flexDirection: 'row',
                            left: -zeroPositon + initialOffset
                        }]}>
                            {[-1, 0, 1].map(
                                value => {
                                    if (value === fullPosition.Upper.position) {
                                        return <View key={1} style={{
                                            width: dimensions.width,
                                            top: 0,
                                        }}
                                        >
                                            <DateRangePicker range={fullPosition.Upper.range}
                                                             setRange={setRange}/>
                                            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                                            {getScrollView(fullPosition.Upper.range, exercise)}
                                        </View>
                                    }
                                    if (value === fullPosition.Middle.position) {
                                        return <View key={2} style={{
                                            width: dimensions.width,
                                            top: 0,
                                        }}>
                                            <DateRangePicker range={fullPosition.Middle.range}
                                                             setRange={setRange}/>
                                            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                                            {getScrollView(fullPosition.Middle.range, exercise)}
                                        </View>
                                    }
                                    if (value === fullPosition.Lower.position) {
                                        return (
                                            <View key={3} style={{
                                                width: dimensions.width,
                                                top: 0,
                                            }}>
                                                <DateRangePicker range={fullPosition.Lower.range}
                                                                 setRange={setRange}/>
                                                <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
                                                {getScrollView(fullPosition.Lower.range, exercise)}
                                            </View>
                                        )
                                    }
                                })
                            }
                        </Animated.View>
                    </GestureDetector>
                </ScrollView>
            </GestureHandlerRootView>
        )
    }
;
const SNAP_POINT = 3;

export type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default History;
