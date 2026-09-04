import React, {useCallback, useEffect, useRef} from 'react';
import {GestureResponderEvent, Keyboard, LayoutChangeEvent, ScrollView, ScrollViewProps, TextInput} from 'react-native';

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

/**
 * Interval between the checks that watch for a focus change after a tap.
 *
 * With the keyboard already open, tapping another field fires no keyboard event
 * and no layout pass — the only signal is the touch itself, and native reports
 * the new focus a moment later.
 */
const FOCUS_SWITCH_DELAY_MS = 120;

/**
 * How often to re-ask which input holds the focus after a tap, before giving up.
 *
 * A tapped cell does not simply move the focus: it MOUNTS its text input and lets
 * `autoFocus` take the focus once the native view is attached to the window (see
 * PlanQuickEditSetRow). On the audit device that lands a few hundred ms after the
 * touch, and until then `currentlyFocusedInput()` still reports the previous input
 * or none at all — a single early check sees "nothing changed" and does nothing.
 * Eight attempts cover roughly a second and stop as soon as the focus moved.
 */
const FOCUS_SWITCH_ATTEMPTS = 8;

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

const KeyboardAwareScrollView = ({children, onLayout, onTouchStart, ...scrollViewProps}: KeyboardAwareScrollViewProps) => {
  const scrollRef = useRef<MeasurableScrollView>(null);
  /** Screen Y of the keyboard's top edge, or null while the keyboard is closed. */
  const keyboardTopRef = useRef<number | null>(null);
  const pendingCorrectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const correctionsLeftRef = useRef(0);
  /** Breaks the cycle between measuring and re-scheduling the next measurement. */
  const scheduleCorrectionRef = useRef<(delay: number) => void>(() => {});
  /** The input the last correction was measured for — how a focus CHANGE is recognised. */
  const alignedInputRef = useRef<object | null>(null);
  const focusCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusAttemptsLeftRef = useRef(0);
  /** Same self-reference trick as above, for the focus check re-arming itself. */
  const scheduleFocusCheckRef = useRef<() => void>(() => {});

  const ensureFocusedInputVisible = useCallback(() => {
    const scrollView = scrollRef.current;
    const focusedInput = TextInput.State.currentlyFocusedInput();
    if (scrollView === null || focusedInput === null || focusedInput === undefined || keyboardTopRef.current === null) {
      return;
    }
    // Recorded before the measurement, not after: this input is now the one the
    // component is aligning for, whether or not it ends up having to move.
    alignedInputRef.current = focusedInput;
    // The scroller's own screen box has to come from the native view; the
    // ScrollView wrapper does not expose measure methods itself.
    const scrollNode = scrollView.getNativeScrollRef();
    // The content view is the coordinate space scrollTo() works in.
    const innerNode = scrollView.getInnerViewRef();
    if (scrollNode === null || scrollNode === undefined || innerNode === null || innerNode === undefined) {
      return;
    }

    /**
     * A measurement is not one step but a chain of native callbacks, and the user
     * keeps acting while it runs: they close the keyboard again, or tap the next
     * field. Scrolling on numbers gathered before that would move the view after
     * the keyboard is gone, or briefly snap back to the field they just left.
     * Cancelling the pending timers on hide is not enough — a chain that already
     * started cannot be cancelled, so every step re-checks instead.
     */
    const measurementIsStale = () => keyboardTopRef.current === null || TextInput.State.currentlyFocusedInput() !== focusedInput;

    scrollNode.measureInWindow((_scrollX: number, scrollY: number, _scrollWidth: number, scrollHeight: number) => {
      if (!Number.isFinite(scrollY) || !Number.isFinite(scrollHeight) || scrollHeight <= 0 || measurementIsStale()) {
        return;
      }
      focusedInput.measureInWindow((_screenX: number, inputScreenY: number, _screenWidth: number, inputHeight: number) => {
        if (!Number.isFinite(inputScreenY) || !Number.isFinite(inputHeight) || inputHeight <= 0 || measurementIsStale()) {
          return;
        }
        // Read after the staleness check, so the geometry is the keyboard's
        // current one rather than the one this chain started with.
        const keyboardTop = keyboardTopRef.current;
        if (keyboardTop === null) {
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
            if (!Number.isFinite(contentY) || measurementIsStale()) {
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

  /**
   * Watches for the focus moving to another input, and corrects for the new one.
   * Re-arms itself until the focus changed or the attempts are used up, because the
   * tapped cell mounts its input first and only then takes the focus.
   */
  const scheduleFocusCheck = useCallback(() => {
    if (focusCheckRef.current !== null) {
      clearTimeout(focusCheckRef.current);
    }
    focusCheckRef.current = setTimeout(() => {
      focusCheckRef.current = null;
      const focusedInput = TextInput.State.currentlyFocusedInput();
      if (focusedInput !== null && focusedInput !== undefined && focusedInput !== alignedInputRef.current) {
        correctionsLeftRef.current = MAX_CORRECTIONS;
        scheduleCorrection(0);
        return;
      }
      focusAttemptsLeftRef.current -= 1;
      if (focusAttemptsLeftRef.current > 0) {
        scheduleFocusCheckRef.current();
      }
    }, FOCUS_SWITCH_DELAY_MS);
  }, [scheduleCorrection]);
  scheduleFocusCheckRef.current = scheduleFocusCheck;

  useEffect(() => {
    // `screenY` is available on every supported Android version: below API 30 RN
    // derives the keyboard from the window's visible display frame, which is
    // exactly what `adjustResize` (this app's softInputMode) shrinks — only
    // `adjustNothing` would leave that frame untouched.
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      correctionsLeftRef.current = MAX_CORRECTIONS;
      scheduleCorrection(RESIZE_DELAY_MS);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      correctionsLeftRef.current = 0;
      alignedInputRef.current = null;
      focusAttemptsLeftRef.current = 0;
      if (pendingCorrectionRef.current !== null) {
        clearTimeout(pendingCorrectionRef.current);
        pendingCorrectionRef.current = null;
      }
      if (focusCheckRef.current !== null) {
        clearTimeout(focusCheckRef.current);
        focusCheckRef.current = null;
      }
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (pendingCorrectionRef.current !== null) {
        clearTimeout(pendingCorrectionRef.current);
        pendingCorrectionRef.current = null;
      }
      if (focusCheckRef.current !== null) {
        clearTimeout(focusCheckRef.current);
        focusCheckRef.current = null;
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

  /**
   * The second trigger, next to `keyboardDidShow` and the resize layout: moving
   * the focus while the keyboard is ALREADY open — reps → weight, or a field in
   * another exercise card. That fires no keyboard event and no layout pass, so
   * without this the newly focused field stays behind the keyboard.
   *
   * A touch alone is not enough of a reason to scroll: dragging the list with the
   * keyboard open must not snap back to the focused field. Hence the comparison
   * against the input the last correction was measured for — only a real focus
   * CHANGE triggers a new one.
   *
   * `onTouchStart` rather than the responder-capture hook: ScrollView installs its
   * own `onStartShouldSetResponderCapture` and would drop a prop of that name,
   * while it explicitly forwards `onTouchStart`.
   */
  const handleTouchStart = (event: GestureResponderEvent) => {
    onTouchStart?.(event);
    if (keyboardTopRef.current === null) {
      return;
    }
    focusAttemptsLeftRef.current = FOCUS_SWITCH_ATTEMPTS;
    scheduleFocusCheck();
  };

  return (
    <ScrollView {...scrollViewProps} ref={scrollRef} onLayout={handleLayout} onTouchStart={handleTouchStart}>
      {children}
    </ScrollView>
  );
};

export default KeyboardAwareScrollView;
