import React from 'react';
import {Keyboard, ScrollView, Text} from 'react-native';
import {act, render} from '@testing-library/react-native';
import KeyboardAwareScrollView from '../../../app/components/common/KeyboardAwareScrollView';

/**
 * GH-428 (H2): the plan editor's scroller must lift the focused input clear of
 * the keyboard — and must NOT move anything when the input is already visible
 * (that would be the layout jump / flicker the ticket rules out).
 */

const KEYBOARD_GAP = 16;

// Screen geometry taken from the audit device (720 x 1600): the scroller fills
// the screen, the keyboard's top edge sits at y = 930.
const SCROLL_SCREEN_Y = 0;
const SCROLL_HEIGHT = 1600;
const KEYBOARD_TOP = 930;

let focusedInputRect = {x: 0, y: 0, width: 200, height: 60};

const measureInWindowMock = jest.fn();

const fakeFocusedInput = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
    callback(focusedInputRect.x, focusedInputRect.y, focusedInputRect.width, focusedInputRect.height);
  },
};

let mockFocusedInput: typeof fakeFocusedInput | null = fakeFocusedInput;

jest.mock('react-native/Libraries/Components/TextInput/TextInputState', () => ({
  currentlyFocusedInput: () => mockFocusedInput,
}));

const renderScroller = () => {
  const utils = render(
    <KeyboardAwareScrollView>
      <Text>content</Text>
    </KeyboardAwareScrollView>,
  );

  const scrollViewInstance = utils.UNSAFE_getByType(ScrollView).instance as any;
  scrollViewInstance.measureInWindow = (callback: (x: number, y: number, w: number, h: number) => void) => {
    measureInWindowMock();
    callback(0, SCROLL_SCREEN_Y, 720, SCROLL_HEIGHT);
  };
  const scrollTo = jest.fn();
  scrollViewInstance.scrollTo = scrollTo;

  return {...utils, scrollTo};
};

// RN's Keyboard is no longer an event emitter that tests can `emit` on, so the
// registered listeners are captured from addListener and invoked directly.
const keyboardListeners: Record<string, ((event: any) => void)[]> = {};

const emitKeyboard = (event: 'keyboardDidShow' | 'keyboardDidHide', screenY: number) => {
  act(() => {
    (keyboardListeners[event] ?? []).forEach((listener) =>
      listener({endCoordinates: {screenX: 0, screenY, width: 720, height: 1600 - screenY}, duration: 0, easing: 'keyboard'}),
    );
  });
  // The component defers the measurement to the next frame.
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const openKeyboard = () => emitKeyboard('keyboardDidShow', KEYBOARD_TOP);

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
    focusedInputRect = {x: 0, y: 0, width: 200, height: 60};
    measureInWindowMock.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('scrolls a field hidden behind the keyboard exactly clear of it', () => {
    // The audit's field: y = 1081..1141, keyboard top at 930.
    focusedInputRect = {x: 0, y: 1081, width: 200, height: 60};
    const {scrollTo} = renderScroller();

    openKeyboard();

    // Missing distance = field bottom (1141) - (keyboard top 930 - gap 16) = 227.
    expect(scrollTo).toHaveBeenCalledWith({y: 1141 - (KEYBOARD_TOP - KEYBOARD_GAP), animated: true});
  });

  it('does not move at all when the focused field is already visible', () => {
    focusedInputRect = {x: 0, y: 300, width: 200, height: 60};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('leaves a field that ends exactly on the gap boundary untouched', () => {
    focusedInputRect = {x: 0, y: KEYBOARD_TOP - KEYBOARD_GAP - 60, width: 200, height: 60};
    const {scrollTo} = renderScroller();

    openKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('never scrolls to a negative offset', () => {
    // Field above the visible top while the scroller is at offset 0.
    focusedInputRect = {x: 0, y: -200, width: 200, height: 60};
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

  it('does nothing after the keyboard closed again', () => {
    focusedInputRect = {x: 0, y: 1081, width: 200, height: 60};
    const {scrollTo} = renderScroller();

    openKeyboard();
    scrollTo.mockClear();

    emitKeyboard('keyboardDidHide', 1600);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
