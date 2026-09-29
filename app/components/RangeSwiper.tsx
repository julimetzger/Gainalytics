import React, {useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent, LayoutRectangle, useWindowDimensions, View} from 'react-native';
import Animated, {Easing, ReduceMotion, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView, State} from 'react-native-gesture-handler';

interface PositionRange<T> {
  position: number;
  range: T;
}

interface FullPosition<T> {
  Upper: PositionRange<T>;
  Lower: PositionRange<T>;
  Middle: PositionRange<T>;
  activeView: ViewPosition;
  range: T;
  traveledIndex: number;
}

enum ViewPosition {
  UPPER,
  MIDDLE,
  LOWER,
}

const userConfig = {
  duration: 500,
  easing: Easing.inOut(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

interface RangeSwiperProps<T> {
  /**
   * `isActivePane` tells which of the three panes is the one the user is on.
   * Comparing ranges is not enough: at the edge of the range the neighbour
   * pane shows the same value as the active one (PERF-003).
   */
  nodeFunction: (range: T, setRange: (range: T) => void, isActivePane: boolean) => React.ReactNode;
  notSwipeableContent?: React.ReactNode;
  determineValueByIndex: (index: number, range: T) => T;
  startValue: T;
  onUpdateCurrentIndex?: (index: number) => void;
  enabled?: boolean;
  ignoreSwipe?: LayoutRectangle[];
  /**
   * Set when every pane contains its own vertical scroller (e.g. a
   * NestableScrollContainer). Pins the row to the viewport height so the
   * pane's scroller owns vertical scrolling. The default active-pane-height
   * clamp must not be used in that case: a ScrollView pane always fills
   * whatever height the row gives it, so onLayout can only ever re-measure
   * the clamp itself — the row height gets stuck while the pane content
   * changes underneath it, cutting off or voiding the scroll range (GH-382).
   */
  fillViewport?: boolean;
}

const RangeSwiper = <T extends any>({nodeFunction, notSwipeableContent, determineValueByIndex, startValue, onUpdateCurrentIndex, ignoreSwipe, enabled = true, fillViewport = false}: RangeSwiperProps<T>) => {
  const [fullPosition, setFullPosition] = useState({
    Upper: {position: -1, range: determineValueByIndex(-1, startValue)},
    Middle: {position: 0, range: determineValueByIndex(0, startValue)},
    Lower: {position: 1, range: determineValueByIndex(1, startValue)},
    activeView: ViewPosition.MIDDLE,
    range: startValue,
    traveledIndex: 0,
  } as FullPosition<T>);
  let dimensions = useWindowDimensions();
  let initialOffset = -dimensions.width;
  const xPosition = useSharedValue(0);
  const [isPanEnabled, setIsPanEnabled] = useState(enabled);
  useEffect(() => {
    if (enabled) setIsPanEnabled(true);
    if (!enabled) setIsPanEnabled(false);
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
        traveledIndex: fullPosition.traveledIndex + 1,
      });
    }
    if (fullPosition.activeView === ViewPosition.LOWER) {
      setFullPosition({
        activeView: ViewPosition.MIDDLE,
        Upper: {position: -1, range: determineValueByIndex(-1, newRange)},
        Middle: {position: 0, range: newRange},
        Lower: {position: 1, range: determineValueByIndex(1, newRange)},
        range: newRange,
        traveledIndex: fullPosition.traveledIndex + 1,
      });
    }
    if (fullPosition.activeView === ViewPosition.UPPER) {
      setFullPosition({
        activeView: ViewPosition.LOWER,
        Upper: {position: 1, range: determineValueByIndex(1, newRange)},
        Middle: {position: -1, range: determineValueByIndex(-1, newRange)},
        Lower: {position: 0, range: newRange},
        range: newRange,
        traveledIndex: fullPosition.traveledIndex + 1,
      });
    }
  }

  function uiplusOne() {
    let newRange = determineValueByIndex(1, fullPosition.range);
    onUpdateCurrentIndex && onUpdateCurrentIndex(1);
    if (fullPosition.activeView === ViewPosition.MIDDLE) {
      setFullPosition({
        activeView: ViewPosition.LOWER,
        Upper: {position: 1, range: determineValueByIndex(1, newRange)},
        Middle: {position: -1, range: determineValueByIndex(-1, newRange)},
        Lower: {position: 0, range: newRange},
        range: newRange,
        traveledIndex: fullPosition.traveledIndex - 1,
      });
    }
    if (fullPosition.activeView === ViewPosition.LOWER) {
      setFullPosition({
        activeView: ViewPosition.UPPER,
        Upper: {position: 0, range: newRange},
        Middle: {position: 1, range: determineValueByIndex(1, newRange)},
        Lower: {position: -1, range: determineValueByIndex(-1, newRange)},
        range: newRange,
        traveledIndex: fullPosition.traveledIndex - 1,
      });
    }
    if (fullPosition.activeView === ViewPosition.UPPER) {
      setFullPosition({
        activeView: ViewPosition.MIDDLE,
        Upper: {position: -1, range: determineValueByIndex(-1, newRange)},
        Middle: {position: 0, range: newRange},
        Lower: {position: 1, range: determineValueByIndex(1, newRange)},
        range: newRange,
        traveledIndex: fullPosition.traveledIndex - 1,
      });
    }
  }

  useEffect(() => {}, [ignoreSwipe]);

  // The three panes sit side by side in a row, so without a height constraint
  // the vertical scroll extent equals the TALLEST pane — including the two
  // off-screen neighbours — leaving dead scroll space below shorter content.
  // Track each pane's natural height and clamp the row to the active pane.
  const [paneHeights, setPaneHeights] = useState<{[key in ViewPosition]?: number}>({});
  const makePaneOnLayout = (pane: ViewPosition) => (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setPaneHeights((prev) => (prev[pane] === height ? prev : {...prev, [pane]: height}));
  };
  const activePaneHeight = fillViewport ? undefined : paneHeights[fullPosition.activeView];
  const paneOnLayout = (pane: ViewPosition) => (fillViewport ? undefined : makePaneOnLayout(pane));

  // GH-324: clamp only the two OFF-SCREEN panes, never the active one and
  // never the row. Clamping the row (previous approach) deadlocked the layout:
  // once the row was fixed to the active pane's measured height, the pane
  // could never re-measure taller, so content that grows after the first
  // measure (e.g. the plan full-edit list) was clipped forever.
  const paneStyle = (pane: ViewPosition) => ({
    width: dimensions.width,
    top: 0,
    ...(pane !== fullPosition.activeView && activePaneHeight !== undefined ? {height: activePaneHeight, overflow: 'hidden' as const} : {}),
  });

  const zeroPositon = fullPosition.traveledIndex * dimensions.width;

  const refa = useRef();

  const initialTouchLocation = useSharedValue<{x: number; y: number} | null>(null);

  const SWIPE_THRESHOLD = 1;

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
      if (ignoreSwipe?.length !== 0 && ignoreSwipe?.some((rect) => initialTouchLocation.value.y > rect.y - 15 && initialTouchLocation.value.y < rect.y + rect.height + 15)) {
        state.fail();
      }
      const xDiff = Math.abs(evt.changedTouches[0].x - initialTouchLocation.value.x);
      const yDiff = Math.abs(evt.changedTouches[0].y - initialTouchLocation.value.y);
      const isHorizontalPanning = xDiff > yDiff && xDiff > SWIPE_THRESHOLD;

      if (!isPanEnabled) state.fail();

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
          reduceMotion: ReduceMotion.System,
        });
        return;
      }
    })
    .withRef(refa)
    .enabled(isPanEnabled);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: xPosition.value}],
  }));

  function setRange(t: T) {
    setFullPosition({
      activeView: fullPosition.activeView,
      Upper: {...fullPosition.Upper, range: determineValueByIndex(fullPosition.Upper.position, t)},
      Middle: {...fullPosition.Middle, range: determineValueByIndex(fullPosition.Middle.position, t)},
      Lower: {...fullPosition.Lower, range: determineValueByIndex(fullPosition.Lower.position, t)},
      range: t,
      traveledIndex: fullPosition.traveledIndex,
    });
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

  // In fillViewport mode there is no outer vertical ScrollView at all: the
  // panes scroll internally, so the row just fills the screen. Inside a
  // ScrollView's unbounded content a flex/height pin cannot work — the row
  // would grow to the tallest pane again.
  const Container: React.ComponentType<any> = fillViewport ? View : Animated.ScrollView;
  const containerProps = fillViewport
    ? {style: {flex: 1}}
    : {
        keyboardShouldPersistTaps: 'always',
        onScroll,
        onScrollEndDrag: () => setIsPanEnabled(true),
      };

  return (
    <GestureHandlerRootView style={fillViewport ? {flex: 1} : undefined}>
      <Container {...containerProps}>
        {notSwipeableContent}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            testID="range-swiper-row"
            style={[
              animatedStyle,
              {
                flexDirection: 'row',
                left: -zeroPositon + initialOffset,
              },
              fillViewport
                ? // Panes scroll internally: pin the row (and thus every pane)
                  // to the bounded container so the pane's own scroller gets a
                  // bounded height and owns vertical scrolling.
                  //
                  // GH-414: the row must also be as WIDE as the panes it holds.
                  // With only the container's width it ends after the first pane,
                  // so the visible pane (the row is shifted left by one viewport)
                  // lies outside its parent's box. React Native's own touch target
                  // search still finds it, which is why taps kept working — but
                  // Android's ViewGroup touch dispatch clips to the parent bounds,
                  // so the pane's ScrollView never saw the drag and nothing
                  // scrolled. Only fillViewport is affected: without it the
                  // vertical scroller is RangeSwiper's own ScrollView, which sits
                  // ABOVE the row and is never clipped.
                  {flex: 1, width: dimensions.width * PANE_COUNT}
                : {
                    // GH-324: the row keeps its natural (auto) height and follows the
                    // ACTIVE pane, which is never height-clamped. Only the two off-screen
                    // neighbour panes are clamped (see paneStyle), so the scrollable area
                    // still ends at the active pane instead of at the tallest neighbour
                    // (GH-356) — without freezing the layout at the first measured height,
                    // which clipped content that grows later (plan full-edit list).
                    // No flexGrow here either: stretching the row to fill the viewport
                    // would recreate the dead space whenever a pane is shorter than the screen.
                    alignItems: 'flex-start',
                  },
            ]}
          >
            {/* PERF-003: the panes are rendered in a FIXED order and moved into their slot with a translation.
                Ordering them by position (as before) made React move the pane views inside the row on every
                swipe — Android then detaches and re-attaches them and has to re-record the whole content of the
                pane, a ~20 ms frame for a pane with a full training on it. */}
            {[
              {key: 1, testID: 'range-swiper-pane-upper', view: ViewPosition.UPPER, pane: fullPosition.Upper},
              {key: 2, testID: 'range-swiper-pane-middle', view: ViewPosition.MIDDLE, pane: fullPosition.Middle},
              {key: 3, testID: 'range-swiper-pane-lower', view: ViewPosition.LOWER, pane: fullPosition.Lower},
            ].map(({key, testID, view, pane}, domIndex) => (
              <View
                key={key}
                testID={testID}
                onLayout={paneOnLayout(view)}
                // slot = position + 1 (-1 -> leftmost); the view naturally sits in slot `domIndex`
                style={[paneStyle(view), {transform: [{translateX: (pane.position + 1 - domIndex) * dimensions.width}]}]}
              >
                {nodeFunction(pane.range, setRange, fullPosition.activeView === view)}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </Container>
    </GestureHandlerRootView>
  );
};
const SNAP_POINT = 3;
/**
 * When a screen that keeps its heavy content out of the neighbour panes should mount it after a swipe:
 * 90 % into the snap animation (`userConfig.duration`). The animation is an ease-in-out, so at that point
 * it has covered ~98 % of the way and only creeps the last few dp — the staged mount then finishes shortly
 * after the pane has come to rest instead of after a further half second of an empty pane.
 */
export const SWIPE_SETTLE_MS = Math.round(userConfig.duration * 0.9);
/** Upper, Middle and Lower — the row always renders exactly these three panes. */
export const PANE_COUNT = 3;

export default RangeSwiper;
