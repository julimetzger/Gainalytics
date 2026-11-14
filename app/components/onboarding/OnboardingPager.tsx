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

  // Follow the controlled page; jump without animation on mount (e.g. back from the templates).
  useEffect(() => {
    ref.current?.scrollTo({x: page * width, y: 0, animated: mounted.current});
    mounted.current = true;
  }, [page, width]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settled = Math.round(e.nativeEvent.contentOffset.x / width);
      const clamped = Math.max(0, Math.min(children.length - 1, settled));
      if (clamped !== page) onPageChange(clamped);
    },
    [children.length, onPageChange, page, width],
  );

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
      contentOffset={{x: page * width, y: 0}}
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
