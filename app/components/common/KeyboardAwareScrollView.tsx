import React, {useCallback, useEffect, useRef} from 'react';
import {Keyboard, LayoutChangeEvent, ScrollView, ScrollViewProps, TextInput} from 'react-native';

/**
 * GH-428 (H2): a ScrollView that keeps the focused text input above the
 * software keyboard.
 *
 * Android's `adjustResize` shrinks the window, so content below the keyboard is
 * still *reachable* by scrolling — but nothing scrolls there on its own. When
 * the user taps a set row in the lower half of the plan editor, the keyboard
 * opens over the very row being edited: they type into a field they cannot see,
 * and a follow-up tap on the neighbouring field hits the keyboard instead.
 *
 * Deliberately no extra dependency and no bottom padding: padding would move the
 * content the moment the keyboard opens (a visible layout jump) and would fight
 * with `adjustResize`. Instead this measures the focused input against the
 * keyboard's top edge and scrolls by exactly the missing amount — if the input
 * is already visible, nothing moves at all.
 */

/**
 * Breathing room between the focused field and the keyboard's top edge, in dp.
 *
 * What gets measured is the bare text input; what the user needs to see is the
 * row around it — the cell's border and padding, its unit label, the neighbouring
 * fields. Measured on the audit device, the reported keyboard top also sits a few
 * dp below where the IME actually starts drawing (its toolbar strip). A gap of
 * one input height covers both, and costs nothing when the field is already
 * visible, because then no scroll happens at all.
 */
const KEYBOARD_GAP = 48;

/** Ignore sub-pixel moves — scrolling by them only causes flicker. */
const MIN_SCROLL_DELTA = 1;

/** Wait for the keyboard-driven window resize to reach layout before measuring. */
const RESIZE_DELAY_MS = 120;

/** Wait for an animated scroll to report its final position before re-checking. */
const SETTLE_DELAY_MS = 260;

/** Upper bound on re-checks per keyboard opening, so a chain can never run away. */
const MAX_CORRECTIONS = 4;

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
}

/**
 * `getInnerViewRef` is part of ScrollView's imperative API (ScrollView.js) but
 * the bundled type definitions only declare the older `getInnerViewNode`, which
 * returns a node handle that Fabric's measureLayout no longer accepts.
 */
interface MeasurableScrollView extends ScrollView {
  getInnerViewRef: () => object | null | undefined;
}

const KeyboardAwareScrollView = ({children, onLayout, ...scrollViewProps}: KeyboardAwareScrollViewProps) => {
  const scrollRef = useRef<MeasurableScrollView>(null);
  /** Screen Y of the keyboard's top edge, or null while the keyboard is closed. */
  const keyboardTopRef = useRef<number | null>(null);
  const pendingCorrectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const correctionsLeftRef = useRef(0);
  /** Breaks the cycle between measuring and re-scheduling the next measurement. */
  const scheduleCorrectionRef = useRef<(delay: number) => void>(() => {});

  const ensureFocusedInputVisible = useCallback(() => {
    const scrollView = scrollRef.current;
    const focusedInput = TextInput.State.currentlyFocusedInput();
    const keyboardTop = keyboardTopRef.current;
    if (scrollView === null || focusedInput === null || focusedInput === undefined || keyboardTop === null) {
      return;
    }
    // The scroller's own screen box has to come from the native view; the
    // ScrollView wrapper does not expose measure methods itself.
    const scrollNode = scrollView.getNativeScrollRef();
    // The content view is the coordinate space scrollTo() works in.
    const innerNode = scrollView.getInnerViewRef();
    if (scrollNode === null || scrollNode === undefined || innerNode === null || innerNode === undefined) {
      return;
    }

    scrollNode.measureInWindow((_scrollX: number, scrollY: number, _scrollWidth: number, scrollHeight: number) => {
      if (!Number.isFinite(scrollY) || !Number.isFinite(scrollHeight) || scrollHeight <= 0) {
        return;
      }
      focusedInput.measureInWindow((_screenX: number, inputScreenY: number, _screenWidth: number, inputHeight: number) => {
        if (!Number.isFinite(inputScreenY) || !Number.isFinite(inputHeight) || inputHeight <= 0) {
          return;
        }
        // How much of the scroller is actually on screen: its own height, cut
        // off by the keyboard when the window did not resize (or only partly).
        const visibleHeight = Math.min(scrollHeight, Math.max(0, keyboardTop - scrollY));
        const visibleTop = scrollY + KEYBOARD_GAP;
        const visibleBottom = scrollY + visibleHeight - KEYBOARD_GAP;

        const hiddenBelowBy = inputScreenY + inputHeight - visibleBottom;
        const hiddenAboveBy = visibleTop - inputScreenY;
        if (hiddenBelowBy <= 0 && hiddenAboveBy <= 0) {
          // Already fully visible — moving now would be the layout jump this
          // component exists to avoid.
          return;
        }

        focusedInput.measureLayout(
          innerNode as never,
          (_contentX: number, contentY: number) => {
            if (!Number.isFinite(contentY)) {
              return;
            }
            // The same view measured in two spaces gives the scroller's TRUE
            // current offset. Deriving it here rather than tracking onScroll
            // means a scroll still animating cannot feed back a stale value.
            const currentOffset = contentY - (inputScreenY - scrollY);
            const desiredOffset = hiddenBelowBy > 0 ? currentOffset + hiddenBelowBy : currentOffset - hiddenAboveBy;
            const targetOffset = Math.max(0, desiredOffset);
            if (Math.abs(targetOffset - currentOffset) < MIN_SCROLL_DELTA) {
              return;
            }
            scrollView.scrollTo({y: targetOffset, animated: true});
            // Re-check once the scroll settled. With the offset derived above
            // this is normally a no-op; it catches the case where the layout
            // was still moving when the measurement was taken.
            scheduleCorrectionRef.current(SETTLE_DELAY_MS);
          },
          () => {
            // Measuring failed (view detached mid-flight) — nothing to correct.
          },
        );
      });
    });
  }, []);

  // Coalesces the several triggers that fire around a keyboard opening
  // (keyboardDidShow, then one or more resize layouts) into a single
  // measurement taken once the layout settled.
  const scheduleCorrection = useCallback(
    (delay: number) => {
      if (correctionsLeftRef.current <= 0) {
        return;
      }
      if (pendingCorrectionRef.current !== null) {
        clearTimeout(pendingCorrectionRef.current);
      }
      pendingCorrectionRef.current = setTimeout(() => {
        pendingCorrectionRef.current = null;
        correctionsLeftRef.current -= 1;
        ensureFocusedInputVisible();
      }, delay);
    },
    [ensureFocusedInputVisible],
  );
  scheduleCorrectionRef.current = scheduleCorrection;

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      correctionsLeftRef.current = MAX_CORRECTIONS;
      scheduleCorrection(RESIZE_DELAY_MS);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      correctionsLeftRef.current = 0;
      if (pendingCorrectionRef.current !== null) {
        clearTimeout(pendingCorrectionRef.current);
        pendingCorrectionRef.current = null;
      }
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (pendingCorrectionRef.current !== null) {
        clearTimeout(pendingCorrectionRef.current);
        pendingCorrectionRef.current = null;
      }
    };
  }, [scheduleCorrection]);

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    if (keyboardTopRef.current !== null) {
      // The keyboard-driven window resize arrives as a layout pass; re-measure
      // against the new viewport instead of the pre-resize one.
      scheduleCorrection(RESIZE_DELAY_MS);
    }
  };

  return (
    <ScrollView {...scrollViewProps} ref={scrollRef} onLayout={handleLayout}>
      {children}
    </ScrollView>
  );
};

export default KeyboardAwareScrollView;
