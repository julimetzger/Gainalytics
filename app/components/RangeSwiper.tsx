import React, {useEffect, useRef, useState} from 'react';
import {useWindowDimensions, View} from 'react-native'
import Animated, {
    Easing,
    ReduceMotion,
    runOnJS, useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView, ScrollView, State} from 'react-native-gesture-handler';


interface PositionRange<T> {
    position: number,
    range: T
}

interface FullPosition<T> {
    Upper: PositionRange<T>,
    Lower: PositionRange<T>,
    Middle: PositionRange<T>,
    activeView: ViewPosition,
    range: T,
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

interface RangeSwiperProps<T> {
    nodeFunction: (range: T, setRange: (range: T) => void) => React.ReactNode,
    notSwipeableContent?: React.ReactNode,
    determineValueByIndex: (index: number, range: T) => T,
    startValue: T,
    onUpdateCurrentIndex?: (index: number) => void,
    enabled?: boolean
}

const RangeSwiper = <T extends any>({
                                        nodeFunction,
                                        notSwipeableContent,
                                        determineValueByIndex,
                                        startValue,
                                        onUpdateCurrentIndex,
                                        enabled = true
                                    }: RangeSwiperProps<T>) => {
        const [fullPosition, setFullPosition] = useState({
            Upper: {position: -1, range: determineValueByIndex(-1, startValue)},
            Middle: {position: 0, range: determineValueByIndex(0, startValue)},
            Lower: {position: 1, range: determineValueByIndex(1, startValue)},
            activeView: ViewPosition.MIDDLE,
            range: startValue,
            traveledIndex: 0
        } as FullPosition<T>)
        let dimensions = useWindowDimensions();
        let initialOffset = -dimensions.width;
        const xPosition = useSharedValue(0);
        const [isPanEnabled, setIsPanEnabled] = useState(enabled);
        useEffect(() => {
            if (enabled)
                setIsPanEnabled(true)
            if (!enabled)
                setIsPanEnabled(false)
        }, [enabled]);

        const updatePanState = (offset: number) => {
            'worklet';
            if (offset > 0) {
                runOnJS(setIsPanEnabled)(false);
            } else if (offset === 0) {
                runOnJS(setIsPanEnabled)(true);
            }
        };

        function uiminusOne() {
            let newRange = determineValueByIndex(-1, fullPosition.range);
            onUpdateCurrentIndex && onUpdateCurrentIndex(-1);
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: determineValueByIndex(1, newRange)},
                    Lower: {position: -1, range: determineValueByIndex(-1, newRange)},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: determineValueByIndex(-1, newRange)},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: determineValueByIndex(1, newRange)},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: determineValueByIndex(1, newRange)},
                    Middle: {position: -1, range: determineValueByIndex(-1, newRange)},
                    Lower: {position: 0, range: newRange},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex + 1
                })
            }
        }

        function uiplusOne() {
            let newRange = determineValueByIndex(1, fullPosition.range)
            onUpdateCurrentIndex && onUpdateCurrentIndex(1);
            if (fullPosition.activeView === ViewPosition.MIDDLE) {
                setFullPosition({
                    activeView: ViewPosition.LOWER,
                    Upper: {position: 1, range: determineValueByIndex(1, newRange)},
                    Middle: {position: -1, range: determineValueByIndex(-1, newRange)},
                    Lower: {position: 0, range: newRange},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.LOWER) {
                setFullPosition({
                    activeView: ViewPosition.UPPER,
                    Upper: {position: 0, range: newRange},
                    Middle: {position: 1, range: determineValueByIndex(1, newRange)},
                    Lower: {position: -1, range: determineValueByIndex(-1, newRange)},
                    range: newRange,
                    traveledIndex: fullPosition.traveledIndex - 1
                })
            }
            if (fullPosition.activeView === ViewPosition.UPPER) {
                setFullPosition({
                    activeView: ViewPosition.MIDDLE,
                    Upper: {position: -1, range: determineValueByIndex(-1, newRange)},
                    Middle: {position: 0, range: newRange},
                    Lower: {position: 1, range: determineValueByIndex(1, newRange)},
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
                const isHorizontalPanning = xDiff > yDiff && xDiff > 1.5 && yDiff < 1;

                if (!isPanEnabled)
                    state.fail();

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
                    if (xPosition.value > dimensions.width / SNAP_POINT + zeroPositon || e.velocityX > 600) {
                        runOnJS(uiminusOne)();
                        xPosition.value = withTiming(zeroPositon + dimensions.width, userConfig);
                        return;
                    }
                    if (xPosition.value < -dimensions.width / SNAP_POINT + zeroPositon || e.velocityX < -600) {
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
            .enabled(isPanEnabled)
        ;

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [
                {translateX: xPosition.value}
            ]
        }));

        function setRange(t: T) {
            setFullPosition({
                activeView: fullPosition.activeView,
                Upper: {...fullPosition.Upper, range: determineValueByIndex(fullPosition.Upper.position, t)},
                Middle: {...fullPosition.Middle, range: determineValueByIndex(fullPosition.Middle.position, t)},
                Lower: {...fullPosition.Lower, range: determineValueByIndex(fullPosition.Lower.position, t)},
                range: t,
                traveledIndex: fullPosition.traveledIndex
            })
        }

        const onScroll = useAnimatedScrollHandler({
            onBeginDrag({contentOffset}) {
                updatePanState(contentOffset.y);
            },
            onEndDrag({contentOffset}) {
                updatePanState(contentOffset.y);
            },
            onMomentumEnd({contentOffset}) {
                updatePanState(contentOffset.y);
            },
        });

        return (
            <GestureHandlerRootView>
                <Animated.ScrollView keyboardShouldPersistTaps={'always'} onScroll={onScroll}
                                     onScrollEndDrag={() => setIsPanEnabled(true)}>
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
                </Animated.ScrollView>
            </GestureHandlerRootView>
        )
    }
;
const SNAP_POINT = 3;

export default RangeSwiper;
