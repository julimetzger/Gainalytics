import React, {useCallback, useEffect, useRef} from 'react';
import {Keyboard, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewProps, TextInput} from 'react-native';

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
 * keyboard's top edge and scrolls by exactly the missing delta — if the input is
 * already visible, the delta is zero and nothing moves at all.
 */

/** Breathing room between the focused field and the keyboard's top edge. */
const KEYBOARD_GAP = 16;

/** Ignore sub-pixel deltas — scrolling by them only causes flicker. */
const MIN_SCROLL_DELTA = 1;

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
}

const KeyboardAwareScrollView = ({children, onLayout, onScroll, ...scrollViewProps}: KeyboardAwareScrollViewProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  /** Screen Y of the keyboard's top edge, or null while the keyboard is closed. */
  const keyboardTopRef = useRef<number | null>(null);

  const ensureFocusedInputVisible = useCallback(() => {
    const scrollView = scrollRef.current;
    const focusedInput = TextInput.State.currentlyFocusedInput();
    const keyboardTop = keyboardTopRef.current;
    if (scrollView === null || focusedInput === null || focusedInput === undefined || keyboardTop === null) {
      return;
    }

    scrollView.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
      if (!Number.isFinite(scrollY) || !Number.isFinite(scrollHeight)) {
        return;
      }
      focusedInput.measureInWindow((_inputX: number, inputY: number, _inputWidth: number, inputHeight: number) => {
        if (!Number.isFinite(inputY) || !Number.isFinite(inputHeight) || inputHeight <= 0) {
          return;
        }
        // The visible window is the scroller's own box, further cut off by the
        // keyboard when the window did not resize (or resized only partly).
        const visibleBottom = Math.min(scrollY + scrollHeight, keyboardTop) - KEYBOARD_GAP;
        const visibleTop = scrollY + KEYBOARD_GAP;

        let delta = 0;
        if (inputY + inputHeight > visibleBottom) {
          delta = inputY + inputHeight - visibleBottom;
        } else if (inputY < visibleTop) {
          // Never scroll the field out of the top edge while fixing the bottom.
          delta = inputY - visibleTop;
        }
        if (Math.abs(delta) < MIN_SCROLL_DELTA) {
          return;
        }
        scrollView.scrollTo({y: Math.max(0, scrollOffsetRef.current + delta), animated: true});
      });
    });
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      // The resize triggered by the keyboard may land before or after this
      // event. Try now, and again from onLayout if the resize comes later.
      requestAnimationFrame(ensureFocusedInputVisible);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [ensureFocusedInputVisible]);

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    if (keyboardTopRef.current !== null) {
      ensureFocusedInputVisible();
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };

  return (
    <ScrollView {...scrollViewProps} ref={scrollRef} onLayout={handleLayout} onScroll={handleScroll} scrollEventThrottle={scrollViewProps.scrollEventThrottle ?? 16}>
      {children}
    </ScrollView>
  );
};

export default KeyboardAwareScrollView;
