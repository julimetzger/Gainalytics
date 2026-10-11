import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {IconButton, useTheme} from 'react-native-paper';

/** How far an open tile sits below its resting place — the room the ✕ lives in. */
export const SWIPE_DELETE_OPEN_OFFSET = 40;
// Pulled past half the open offset (or flung down) the tile snaps open.
const OPEN_THRESHOLD = SWIPE_DELETE_OPEN_OFFSET / 2;
const FLING_VELOCITY = 600;
// Beyond the open offset the tile follows with resistance and stops here.
const MAX_OVERDRAG = 14;
// A drag only becomes a delete swipe once it is clearly vertical: 7 dp down
// before 6 dp sideways. Anything more horizontal fails and leaves the touch
// to the carousel's horizontal scroll.
// 7 dp is deliberately below Android's touch slop (8 dp): the screen's plain
// react-native ScrollView starts its vertical drag at the slop, and once it
// has, gesture-handler cancels this pan — on a page long enough to scroll the
// tile would never open. Activating first makes the ScrollView let go instead.
export const SWIPE_DELETE_ACTIVE_OFFSET_Y = 7;
export const SWIPE_DELETE_FAIL_OFFSET_X = 6;

interface Props {
  isOpen: boolean;
  /** No swipe while the tile is being long-press dragged for reordering. */
  disabled?: boolean;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  /** The tile came to rest — open or back in place. */
  onRest?: (open: boolean) => void;
  deleteTestID: string;
  deleteAccessibilityLabel: string;
  children: React.ReactNode;
}

const clampOffset = (value: number) => {
  if (value <= 0) {
    return 0;
  }
  if (value <= SWIPE_DELETE_OPEN_OFFSET) {
    return value;
  }
  return Math.min(SWIPE_DELETE_OPEN_OFFSET + (value - SWIPE_DELETE_OPEN_OFFSET) / 3, SWIPE_DELETE_OPEN_OFFSET + MAX_OVERDRAG);
};

/**
 * GH-483: a carousel tile that can be pulled down to reveal a ✕ behind it.
 *
 * The tile follows the finger, snaps open past half the way and springs back
 * otherwise. Open/closed is owned by the parent so at most one tile is open.
 *
 * Like PlanEditList's drag handles this runs the gesture on the JS thread and
 * animates with core react-native Animated — reanimated transforms inside the
 * draggable list's cells stopped Fabric from drawing sibling views (GH-324).
 */
const SwipeDeleteTile = ({isOpen, disabled = false, onSwipeStart, onSwipeEnd, onOpen, onClose, onDelete, onRest, deleteTestID, deleteAccessibilityLabel, children}: Props) => {
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const startOffset = useRef(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  // The latest callbacks, so the memoised gesture never calls a stale closure.
  const callbacks = useRef({onSwipeStart, onSwipeEnd, onOpen, onClose, onRest});
  callbacks.current = {onSwipeStart, onSwipeEnd, onOpen, onClose, onRest};

  const springTo = (target: number) => {
    currentOffset.current = target;
    Animated.spring(translateY, {toValue: target, useNativeDriver: true, bounciness: 4, speed: 18}).start(({finished}) => {
      if (finished) {
        callbacks.current.onRest?.(target > 0);
      }
    });
  };

  // Open/closed can change from outside (another tile opened, tap outside, delete).
  useEffect(() => {
    const target = isOpen ? SWIPE_DELETE_OPEN_OFFSET : 0;
    if (currentOffset.current !== target) {
      springTo(target);
    }
  }, [isOpen]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(!disabled)
        // A closed tile only reacts to a pull DOWN; an open one can also be pushed back up.
        .activeOffsetY(isOpen ? [-SWIPE_DELETE_ACTIVE_OFFSET_Y, SWIPE_DELETE_ACTIVE_OFFSET_Y] : SWIPE_DELETE_ACTIVE_OFFSET_Y)
        .failOffsetX([-SWIPE_DELETE_FAIL_OFFSET_X, SWIPE_DELETE_FAIL_OFFSET_X])
        .onStart(() => {
          startOffset.current = isOpenRef.current ? SWIPE_DELETE_OPEN_OFFSET : 0;
          callbacks.current.onSwipeStart();
        })
        .onUpdate((event) => {
          const next = clampOffset(startOffset.current + event.translationY);
          currentOffset.current = next;
          translateY.setValue(next);
        })
        .onEnd((event) => {
          const offset = currentOffset.current;
          const flungDown = event.velocityY > FLING_VELOCITY;
          const flungUp = event.velocityY < -FLING_VELOCITY;
          const open = !flungUp && (offset >= OPEN_THRESHOLD || flungDown);
          springTo(open ? SWIPE_DELETE_OPEN_OFFSET : 0);
          if (open) {
            callbacks.current.onOpen();
          } else {
            callbacks.current.onClose();
          }
        })
        .onFinalize((_event, success) => {
          if (!success) {
            // Cancelled (e.g. the long-press reorder took over): back to where it was.
            springTo(isOpenRef.current ? SWIPE_DELETE_OPEN_OFFSET : 0);
          }
          callbacks.current.onSwipeEnd();
        }),
    [disabled, isOpen],
  );

  const revealOpacity = translateY.interpolate({
    inputRange: [0, SWIPE_DELETE_OPEN_OFFSET * 0.25, SWIPE_DELETE_OPEN_OFFSET],
    outputRange: [0, 0.2, 1],
    extrapolate: 'clamp',
  });
  const revealScale = translateY.interpolate({
    inputRange: [0, SWIPE_DELETE_OPEN_OFFSET],
    outputRange: [0.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <Animated.View style={[styles.reveal, {opacity: revealOpacity, transform: [{scale: revealScale}]}]} pointerEvents={isOpen ? 'box-none' : 'none'}>
        <IconButton
          icon="close"
          mode="contained"
          size={18}
          style={styles.deleteButton}
          containerColor={theme.colors.errorContainer}
          iconColor={theme.colors.onErrorContainer}
          onPress={onDelete}
          testID={deleteTestID}
          accessibilityLabel={deleteAccessibilityLabel}
        />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={{transform: [{translateY}]}}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  reveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SWIPE_DELETE_OPEN_OFFSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    margin: 0,
  },
});

export default SwipeDeleteTile;
