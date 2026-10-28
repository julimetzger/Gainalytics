import React, {ReactNode, useMemo, useRef} from 'react';
import {PanResponder, StyleProp, View, ViewStyle} from 'react-native';

/** Horizontal travel (dp) after which a drag counts as a swipe. */
export const SWIPE_DISTANCE = 40;
/** Movement (dp) a tap may have; anything between this and a swipe does nothing. */
const TAP_SLOP = 10;

export type SwipeIntent = 'next' | 'previous' | 'tap' | undefined;

/**
 * GH-642: what a released touch meant. A swipe to the LEFT reveals the next
 * period (like the old DateRangePicker); a mostly vertical drag is a scroll and
 * never steps the range, so tap, swipe and scroll cannot be confused.
 */
export const swipeIntent = (dx: number, dy: number): SwipeIntent => {
  if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
    return dx < 0 ? 'next' : 'previous';
  }
  if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
    return 'tap';
  }
  return undefined;
};

interface SwipeStepAreaProps {
  onNext?: () => void;
  onPrevious?: () => void;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

/** A touch area that reports a tap or a horizontal swipe (one gesture recognizer, so both never fire for the same touch). */
const SwipeStepArea = ({onNext, onPrevious, onPress, children, style, testID, accessibilityHint}: SwipeStepAreaProps) => {
  // The responder is created once; the latest callbacks are read through the ref.
  const callbacks = useRef({onNext, onPrevious, onPress});
  callbacks.current = {onNext, onPrevious, onPress};

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > TAP_SLOP && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        // A vertical drag belongs to the surrounding ScrollView.
        onPanResponderTerminationRequest: (_, gesture) => Math.abs(gesture.dx) <= Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const intent = swipeIntent(gesture.dx, gesture.dy);
          if (intent === 'next') callbacks.current.onNext?.();
          if (intent === 'previous') callbacks.current.onPrevious?.();
          if (intent === 'tap') callbacks.current.onPress?.();
        },
      }),
    [],
  );

  return (
    // Not `accessible`: that would merge the child texts into one node and hide their testIDs from Maestro.
    <View {...responder.panHandlers} style={style} testID={testID} accessibilityHint={accessibilityHint}>
      {children}
    </View>
  );
};

export default SwipeStepArea;
