import React, {useCallback, useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';

interface OnboardingPagerProps {
  page: number;
  onPageChange: (page: number) => void;
  children: React.ReactNode[];
}

/**
 * GH-693: horizontally swipeable onboarding cards. `page` is controlled by the parent
 * (Next/Back buttons, hardware back), and a swipe reports the page it settled on, so the
 * dots and the step label always follow the visible card.
 */
const OnboardingPager = ({page, onPageChange, children}: OnboardingPagerProps) => {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const ref = useRef<ScrollView>(null);
  const mounted = useRef(false);
  // Only the start position (e.g. page 4 when coming back from the templates). Updating it with
  // every page change would re-apply the offset while the finger is still dragging and fight the swipe.
  const [initialOffset] = useState(() => ({x: page * window.width, y: 0}));
  // True from the finger touching the pager until the page has settled. Only then do scroll
  // events move the page — the animated scrollTo of Next/Back must not feed back into it.
  const userScrolling = useRef(false);
  // The last page reported by a swipe: the pager already shows it, so no scrollTo is needed.
  const reportedBySwipe = useRef<number | null>(null);

  // Follow the controlled page; jump without animation on mount (e.g. back from the templates).
  useEffect(() => {
    if (reportedBySwipe.current === page) {
      reportedBySwipe.current = null;
      return;
    }
    reportedBySwipe.current = null;
    ref.current?.scrollTo({x: page * width, y: 0, animated: mounted.current});
    mounted.current = true;
  }, [page, width]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  }, []);

  const report = useCallback(
    (x: number) => {
      const nearest = Math.max(0, Math.min(children.length - 1, Math.round(x / width)));
      if (nearest !== page) {
        reportedBySwipe.current = nearest;
        onPageChange(nearest);
      }
    },
    [children.length, onPageChange, page, width],
  );

  const onScrollBeginDrag = useCallback(() => {
    userScrolling.current = true;
  }, []);

  // Live: the dots follow the card that is mostly on screen while it is being swiped.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (userScrolling.current) report(e.nativeEvent.contentOffset.x);
    },
    [report],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      userScrolling.current = false;
      report(e.nativeEvent.contentOffset.x);
    },
    [report],
  );

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      onScrollBeginDrag={onScrollBeginDrag}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onMomentumScrollEnd={onMomentumScrollEnd}
      contentOffset={initialOffset}
      style={styles.pager}
      testID="onboarding-pager"
    >
      {children.map((child, i) => (
        <View key={i} style={{width}}>
          <ScrollView contentContainerStyle={styles.page}>{child}</ScrollView>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  pager: {flex: 1},
  page: {paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24},
});

export default OnboardingPager;
