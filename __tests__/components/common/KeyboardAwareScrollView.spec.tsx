import React from 'react';
import {Keyboard, ScrollView, Text} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import KeyboardAwareScrollView from '../../../app/components/common/KeyboardAwareScrollView';

/**
 * GH-428 (H2): the plan editor's scroller must lift the focused input clear of
 * the keyboard — and must NOT move anything when the input is already visible
 * (that would be the layout jump / flicker the ticket rules out).
 *
 * Geometry below is the audit device (720 x 1600): the scroller fills the
 * screen and the keyboard's top edge sits at y = 930.
 */

const KEYBOARD_GAP = 48;
const SCROLL_SCREEN_Y = 0;
const SCROLL_HEIGHT = 1600;
const KEYBOARD_TOP = 930;

/** Where the focused input currently is on screen, and how far down the content. */
let focusedInputRect = {screenY: 0, height: 60, contentY: 0};

const fakeFocusedInput = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
    callback(0, focusedInputRect.screenY, 200, focusedInputRect.height);
  },
  measureLayout: (_relativeTo: unknown, onSuccess: (x: number, y: number, w: number, h: number) => void) => {
    onSuccess(0, focusedInputRect.contentY, 200, focusedInputRect.height);
  },
};

/**
 * A second, independent input — needed for the "keyboard already open, user taps
 * another field" case, where what matters is that the focused input CHANGED.
 */
let otherInputRect = {screenY: 0, height: 60, contentY: 0};

const otherFakeFocusedInput = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
    callback(0, otherInputRect.screenY, 200, otherInputRect.height);
  },
  measureLayout: (_relativeTo: unknown, onSuccess: (x: number, y: number, w: number, h: number) => void) => {
    onSuccess(0, otherInputRect.contentY, 200, otherInputRect.height);
  },
};

/**
 * A third input that answers its measurements only when the test says so.
 *
 * On the device a measurement is a round trip to native, and the user keeps
 * acting while it is in flight — closing the keyboard, tapping the next field.
 * The synchronous fakes above cannot express that gap, so this one queues its
 * callbacks and `releaseMeasurements()` runs them at the chosen moment.
 */
let deferredMeasurements: (() => void)[] = [];

const deferredFakeFocusedInput = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
    deferredMeasurements.push(() => callback(0, focusedInputRect.screenY, 200, focusedInputRect.height));
  },
  measureLayout: (_relativeTo: unknown, onSuccess: (x: number, y: number, w: number, h: number) => void) => {
    deferredMeasurements.push(() => onSuccess(0, focusedInputRect.contentY, 200, focusedInputRect.height));
  },
};

/** Lets native "answer" — including the follow-up steps a released step queues. */
const releaseMeasurements = () => {
  act(() => {
    while (deferredMeasurements.length > 0) {
      (deferredMeasurements.shift() as () => void)();
    }
  });
};

let mockFocusedInput: typeof fakeFocusedInput | null = fakeFocusedInput;

jest.mock('react-native/Libraries/Components/TextInput/TextInputState', () => ({
  currentlyFocusedInput: () => mockFocusedInput,
}));

const keyboardListeners: Record<string, ((event: any) => void)[]> = {};

const SCROLLER_TEST_ID = 'keyboard-aware-scroller';

const renderScroller = () => {
  const utils = render(
    <KeyboardAwareScrollView testID={SCROLLER_TEST_ID}>
      <Text>content</Text>
    </KeyboardAwareScrollView>,
  );

  const scrollViewInstance = utils.UNSAFE_getByType(ScrollView).instance as any;
  scrollViewInstance.getNativeScrollRef = () => ({
    measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) => {
      callback(0, SCROLL_SCREEN_Y, 720, SCROLL_HEIGHT);
    },
  });
  scrollViewInstance.getInnerViewRef = () => ({});
  const scrollTo = jest.fn();
  scrollViewInstance.scrollTo = scrollTo;

  return {...utils, scrollTo};
};

// RN's Keyboard is no longer an event emitter tests can `emit` on, so the
// registered listeners are captured from addListener and invoked directly.
const emitKeyboard = (event: 'keyboardDidShow' | 'keyboardDidHide', screenY: number) => {
  act(() => {
    (keyboardListeners[event] ?? []).forEach((listener) =>
      listener({endCoordinates: {screenX: 0, screenY, width: 720, height: 1600 - screenY}, duration: 0, easing: 'keyboard'}),
    );
  });
  // The correction is debounced until the keyboard-driven layout settles.
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const openKeyboard = () => emitKeyboard('keyboardDidShow', KEYBOARD_TOP);

/** Runs the timer chain the tap handler drives: focus checks, then the measurement. */
const flushTimers = (cycles: number) => {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  }
};

/** A tap inside the scroller, followed by the full focus-check window. */
const tapInsideScroller = (getByTestId: (testID: string) => any) => {
  fireEvent(getByTestId(SCROLLER_TEST_ID), 'touchStart', {nativeEvent: {}});
  flushTimers(12);
};

describe('KeyboardAwareScrollView — GH-428 (H2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.keys(keyboardListeners).forEach((key) => delete keyboardListeners[key]);
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event: any, listener: any) => {
      keyboardListeners[event] = [...(keyboardListeners[event] ?? []), listener];
      return {
        remove: () => {
          keyboardListeners[event] = (keyboardListeners[event] ?? []).filter((entry) => entry !== listener);
        },
      } as any;
    });
    mockFocusedInput = fakeFocusedInput;
    focusedInputRect = {screenY: 0, height: 60, contentY: 0};
    otherInputRect = {screenY: 0, height: 60, contentY: 0};
    deferredMeasurements = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('scrolls a field hidden behind the keyboard exactly clear of it', () => {
    // The audit's field: on screen at y = 1081..1141 while the scroller sits at
    // offset 500 (so the field is at content y = 1581). Keyboard top 930.
    focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
    const {scrollTo} = renderScroller();

    openKeyboard();

    // hidden below by 1141 - (930 - 48) = 259; current offset 1581 - 1081 = 500.
    expect(scrollTo).toHaveBeenCalledWith({y: 759, animated: true});
  });

  it('derives the real offset instead of trusting a tracked one', () => {
    // Same on-screen position, different scroll offset. The target has to follow
    // the derived offset — that is what makes a single pass land exactly, even
    // when an earlier animated scroll has not reported its final position yet.
    focusedInputRect = {screenY: 1081, height: 60, contentY: 1081};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).toHaveBeenCalledWith({y: 259, animated: true});
  });

  it('does not move at all when the focused field is already visible', () => {
    focusedInputRect = {screenY: 300, height: 60, contentY: 300};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('leaves a field that ends exactly on the gap boundary untouched', () => {
    focusedInputRect = {screenY: KEYBOARD_TOP - KEYBOARD_GAP - 60, height: 60, contentY: 0};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('pulls a field back down when it sits above the visible top', () => {
    focusedInputRect = {screenY: -200, height: 60, contentY: 100};
    const {scrollTo} = renderScroller();

    openKeyboard();

    // current offset = 100 - (-200 - 0) = 300; hidden above by 48 - (-200) = 248.
    expect(scrollTo).toHaveBeenCalledWith({y: 52, animated: true});
  });

  it('never scrolls to a negative offset', () => {
    focusedInputRect = {screenY: -200, height: 60, contentY: 0};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).toHaveBeenCalledWith({y: 0, animated: true});
  });

  it('does nothing while no input is focused', () => {
    mockFocusedInput = null;
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  /**
   * PR #430 review, point 1: with the keyboard already open there is no
   * keyboardDidShow and no layout pass. Tapping a second, partly covered field
   * (reps → weight, or a field in another exercise card) has to lift that field
   * too — and dragging the list must still not snap back to the focused one.
   */
  describe('focus change while the keyboard is already open', () => {
    it('lifts a second field that is tapped while the keyboard stays open', () => {
      // First field is visible, so opening the keyboard moves nothing.
      focusedInputRect = {screenY: 300, height: 60, contentY: 300};
      // The tapped one sits behind the keyboard at 1081..1141, content y 1581.
      otherInputRect = {screenY: 1081, height: 60, contentY: 1581};
      const {scrollTo, getByTestId} = renderScroller();

      openKeyboard();
      expect(scrollTo).not.toHaveBeenCalled();

      mockFocusedInput = otherFakeFocusedInput;
      tapInsideScroller(getByTestId);

      // hidden below by 1141 - (930 - 48) = 259; current offset 1581 - 1081 = 500.
      expect(scrollTo).toHaveBeenCalledWith({y: 759, animated: true});
    });

    it('waits for a focus that only arrives once the tapped cell mounted its input', () => {
      focusedInputRect = {screenY: 300, height: 60, contentY: 300};
      otherInputRect = {screenY: 1081, height: 60, contentY: 1581};
      const {scrollTo, getByTestId} = renderScroller();

      openKeyboard();

      // The tapped cell replaces the read-only cell with a text input, so for a
      // moment nothing is focused at all — the old input is already gone and the
      // new one has not been attached to the window yet.
      mockFocusedInput = null;
      fireEvent(getByTestId(SCROLLER_TEST_ID), 'touchStart', {nativeEvent: {}});
      flushTimers(3);
      expect(scrollTo).not.toHaveBeenCalled();

      mockFocusedInput = otherFakeFocusedInput;
      flushTimers(3);

      expect(scrollTo).toHaveBeenCalledWith({y: 759, animated: true});
    });

    it('gives up when no focus change follows the touch', () => {
      focusedInputRect = {screenY: 300, height: 60, contentY: 300};
      otherInputRect = {screenY: 1081, height: 60, contentY: 1581};
      const {scrollTo, getByTestId} = renderScroller();

      openKeyboard();

      // Nothing is focused for the whole watch window — the checks must stop
      // instead of waiting forever for a focus that is not coming.
      mockFocusedInput = null;
      tapInsideScroller(getByTestId);

      mockFocusedInput = otherFakeFocusedInput;
      flushTimers(4);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not move when a touch leaves the focus where it was', () => {
      focusedInputRect = {screenY: 300, height: 60, contentY: 300};
      const {scrollTo, getByTestId} = renderScroller();

      openKeyboard();
      // The user drags the list with the keyboard open until the focused field
      // is off screen. Snapping back to it here would fight that deliberate scroll.
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};

      tapInsideScroller(getByTestId);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('ignores a touch while the keyboard is closed', () => {
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
      const {scrollTo, getByTestId} = renderScroller();

      tapInsideScroller(getByTestId);

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  /**
   * PR #430 review round 3, point 2: cancelling the pending timers on hide is not
   * enough. A measurement that already started cannot be cancelled, and when its
   * native callbacks come back the situation may have moved on — the keyboard is
   * closed again, or the focus is on the next field. Scrolling on those numbers
   * is the late jump / snap-back the user sees.
   */
  describe('a measurement that is still in flight', () => {
    it('answers with the geometry the chain started with', () => {
      // Control: released while the keyboard is still open and the focus
      // unchanged, the deferred input scrolls exactly like the direct one.
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
      mockFocusedInput = deferredFakeFocusedInput;
      const {scrollTo} = renderScroller();

      openKeyboard();
      expect(scrollTo).not.toHaveBeenCalled();

      releaseMeasurements();

      expect(scrollTo).toHaveBeenCalledWith({y: 759, animated: true});
    });

    it('does not scroll when the keyboard closed before the measurement came back', () => {
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
      mockFocusedInput = deferredFakeFocusedInput;
      const {scrollTo} = renderScroller();

      openKeyboard();
      // The user dismisses the keyboard right after tapping the field.
      emitKeyboard('keyboardDidHide', 1600);

      releaseMeasurements();

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll for a field the focus has already left', () => {
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
      mockFocusedInput = deferredFakeFocusedInput;
      const {scrollTo} = renderScroller();

      openKeyboard();
      // Fast tap on the next field: the focus moved on while the first
      // measurement was still running.
      mockFocusedInput = otherFakeFocusedInput;

      releaseMeasurements();

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  /**
   * GH-418 (UX audit GH-498 F1): edge-to-edge means the window no longer shrinks
   * for the keyboard. Content that fits the screen — or a list already scrolled
   * to its end — had nowhere to scroll the field to, and the bottom navigation
   * hiding on keyboardDidShow made the scroller taller and clamped the offset.
   */
  describe('keyboard spacer at the end of the content (GH-418)', () => {
    const KEYBOARD_HEIGHT = 1600 - KEYBOARD_TOP;

    const layoutScroller = (getByTestId: (testID: string) => any, height: number, contentHeight: number) => {
      fireEvent(getByTestId(SCROLLER_TEST_ID), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 720, height}}});
      fireEvent(getByTestId(SCROLLER_TEST_ID), 'contentSizeChange', 720, contentHeight);
    };

    /** The spacer is the content container's bottom padding while the keyboard is open. */
    const spacerOf = (getByTestId: (testID: string) => any): number | undefined => {
      const style = getByTestId(SCROLLER_TEST_ID).props.contentContainerStyle;
      const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style ?? {};
      return flat.paddingBottom;
    };

    const scrollBy = (getByTestId: (testID: string) => any, y: number) => {
      fireEvent.scroll(getByTestId(SCROLLER_TEST_ID), {nativeEvent: {contentOffset: {x: 0, y}}});
    };

    it('adds a spacer of keyboard height in the keyboardDidShow event itself', () => {
      const {getByTestId} = renderScroller();
      expect(spacerOf(getByTestId)).toBeUndefined();

      // No timers run here: the spacer must be part of the very commit in which
      // the navigation bar hides, otherwise the scroller grows first.
      act(() => {
        (keyboardListeners.keyboardDidShow ?? []).forEach((listener) =>
          listener({endCoordinates: {screenX: 0, screenY: KEYBOARD_TOP, width: 720, height: KEYBOARD_HEIGHT}, duration: 0, easing: 'keyboard'}),
        );
      });

      expect(spacerOf(getByTestId)).toBe(KEYBOARD_HEIGHT);
    });

    it('lets a short page scroll its field above the keyboard', () => {
      // A plan that fits the screen: 900 of content in a 1600 scroller, so without
      // the spacer the largest possible offset is 0.
      focusedInputRect = {screenY: 1081, height: 60, contentY: 1081};
      const {scrollTo, getByTestId} = renderScroller();
      layoutScroller(getByTestId, SCROLL_HEIGHT, 1200);

      openKeyboard();

      expect(spacerOf(getByTestId)).toBe(KEYBOARD_HEIGHT);
      expect(scrollTo).toHaveBeenCalledWith({y: 259, animated: true});
    });

    it('removes the spacer right away when the list is not scrolled into it', () => {
      const {getByTestId, scrollTo} = renderScroller();
      layoutScroller(getByTestId, 1300, 3000);
      openKeyboard();
      scrollTo.mockClear();

      scrollBy(getByTestId, 400);
      emitKeyboard('keyboardDidHide', 1600);

      expect(spacerOf(getByTestId)).toBeUndefined();
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls back to the real end before removing the spacer, so nothing jumps', () => {
      const {getByTestId, scrollTo} = renderScroller();
      layoutScroller(getByTestId, 1300, 3000);
      openKeyboard();
      // With the spacer the content is 3000 + 670 high, and the user (or the
      // correction) scrolled to its end: 3670 - 1300.
      fireEvent(getByTestId(SCROLLER_TEST_ID), 'contentSizeChange', 720, 3000 + KEYBOARD_HEIGHT);
      scrollBy(getByTestId, 3000 + KEYBOARD_HEIGHT - 1300);
      scrollTo.mockClear();

      act(() => {
        (keyboardListeners.keyboardDidHide ?? []).forEach((listener) => listener({endCoordinates: {screenX: 0, screenY: 1600, width: 720, height: 0}}));
      });

      // End of the real content in the resting (keyboard closed) viewport.
      expect(scrollTo).toHaveBeenCalledWith({y: 1700, animated: true});
      expect(spacerOf(getByTestId)).toBe(KEYBOARD_HEIGHT);

      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(spacerOf(getByTestId)).toBeUndefined();
    });

    it('keeps the spacer when the keyboard comes straight back', () => {
      const {getByTestId} = renderScroller();
      layoutScroller(getByTestId, 1300, 3000);
      openKeyboard();
      fireEvent(getByTestId(SCROLLER_TEST_ID), 'contentSizeChange', 720, 3000 + KEYBOARD_HEIGHT);
      scrollBy(getByTestId, 3000 + KEYBOARD_HEIGHT - 1300);

      act(() => {
        (keyboardListeners.keyboardDidHide ?? []).forEach((listener) => listener({endCoordinates: {screenX: 0, screenY: 1600, width: 720, height: 0}}));
      });
      openKeyboard();

      expect(spacerOf(getByTestId)).toBe(KEYBOARD_HEIGHT);
    });
  });

  it('does nothing after the keyboard closed again', () => {
    focusedInputRect = {screenY: 1081, height: 60, contentY: 1581};
    const {scrollTo} = renderScroller();

    openKeyboard();
    scrollTo.mockClear();

    emitKeyboard('keyboardDidHide', 1600);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
