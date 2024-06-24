import React, {useRef, useState} from 'react';
import {useWindowDimensions, View} from 'react-native'
import Animated, {
    Easing,
    ReduceMotion,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView, ScrollView, State} from 'react-native-gesture-handler';
import {Range} from "./DateRangePicker";
import {firstDayOfWeek, lastDayOfWeek} from "../utils/DateHelper";


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

const userConfig = {
    duration: 500,
    easing: Easing.inOut(Easing.quad),
    reduceMotion: ReduceMotion.System
};

interface RangeSwiperProps {
    nodeFunction: (range: Range, setRange: (range: Range) => void) => React.ReactNode,
    notSwipeableContent?: React.ReactNode
}

const RangeSwiper = ({nodeFunction, notSwipeableContent}: RangeSwiperProps) => {
        let now = new Date(Date.now());
        const [fullPosition, setFullPosition] = useState({
            Upper: {position: -1, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)).minusRange()},
            Middle: {position: 0, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0))},
            Lower: {position: 1, range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)).plusOneRange()},
            activeView: ViewPosition.MIDDLE,
            range: new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0)),
            traveledIndex: 0
        } as FullPosition)
        let dimensions = useWindowDimensions();
        let initialOffset = -dimensions.width;
        const xPosition = useSharedValue(0);

        function uiminusOne() {
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
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: newRange.plusOneRange()},
                    Middle: {position: -1, range: newRange.minusRange()},
                    Lower: {position: 0, range: newRange},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
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
                const isHorizontalPanning = xDiff > yDiff && xDiff > 1;

                if (isHorizontalPanning) {
                    state.activate();
                } else {
                    if (evt.state !== State.ACTIVE) {
                        state.fail();
                    }
                }
            })
            .onUpdate((e) => {
                xPosition.value = zeroPositon + e.translationX;
            })
            .onEnd((e) => {
                    if (xPosition.value > dimensions.width / SNAP_POINT + zeroPositon || e.velocityX > 400) {
                        runOnJS(uiminusOne)();
                        xPosition.value = withTiming(zeroPositon + dimensions.width, userConfig);
                        return;
                    }
                    if (xPosition.value < -dimensions.width / SNAP_POINT + zeroPositon || e.velocityX < -400) {
                        runOnJS(uiplusOne)();
                        xPosition.value = withTiming(zeroPositon - dimensions.width, userConfig);
                        return;
                    }
                    if (xPosition.value < dimensions.width / SNAP_POINT + zeroPositon && +xPosition.value > -dimensions.width / SNAP_POINT + zeroPositon) {
                        xPosition.value = withTiming(zeroPositon, {
                            duration: 300,
                            easing: Easing.back(2),
                            reduceMotion: ReduceMotion.System
                        });
                        return;
                    }
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
                <ScrollView simultaneousHandlers={refa} keyboardShouldPersistTaps={'always'}>
                    {notSwipeableContent}
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
                                            {nodeFunction(fullPosition.Upper.range, setRange)}
                                        </View>
                                    }
                                    if (value === fullPosition.Middle.position) {
                                        return <View key={2} style={{
                                            width: dimensions.width,
                                            top: 0,
                                        }}>
                                            {nodeFunction(fullPosition.Middle.range, setRange)}
                                        </View>
                                    }
                                    if (value === fullPosition.Lower.position) {
                                        return (
                                            <View key={3} style={{
                                                width: dimensions.width,
                                                top: 0,
                                            }}>
                                                {nodeFunction(fullPosition.Lower.range, setRange)}
                                            </View>
                                        )
                                    }
                                }
                            )
                            }
                        </Animated.View>
                    </GestureDetector>
                </ScrollView>
            </GestureHandlerRootView>
        )
    }
;
const SNAP_POINT = 3;

export default RangeSwiper;
