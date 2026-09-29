import React from 'react';
import {render} from '@testing-library/react-native';
import {StyleSheet, Text} from 'react-native';
import RangeSwiper from '../../app/components/RangeSwiper';

const renderSwiper = (fillViewport: boolean) =>
  render(
    <RangeSwiper<number>
      fillViewport={fillViewport}
      startValue={0}
      determineValueByIndex={(index, range) => range + index}
      nodeFunction={(range) => <Text testID={`pane-content-${range}`}>{`pane ${range}`}</Text>}
    />,
  );

const flat = (style: any) => StyleSheet.flatten(style) as {[key: string]: any};

const PANE_TEST_IDS = ['range-swiper-pane-upper', 'range-swiper-pane-middle', 'range-swiper-pane-lower'];

describe('RangeSwiper pane row geometry', () => {
  // GH-414: the row holds three side-by-side panes and is shifted left by one
  // viewport so the middle one is on screen. When the row's own box is only one
  // viewport wide, the visible pane lies outside its parent's bounds: taps still
  // land (React Native runs its own touch target search) but Android's ViewGroup
  // touch dispatch clips to the parent, so a ScrollView inside the pane never
  // receives the drag — the whole training screen stopped scrolling.
  it('makes the row wide enough to contain every pane in fillViewport mode', () => {
    const {getByTestId} = renderSwiper(true);

    const rowWidth = flat(getByTestId('range-swiper-row').props.style).width;
    const paneWidths = PANE_TEST_IDS.map((testID) => flat(getByTestId(testID).props.style).width);

    expect(paneWidths.every((width) => typeof width === 'number' && width > 0)).toBe(true);
    expect(rowWidth).toBe(paneWidths.reduce((sum, width) => sum + width, 0));
  });

  it('keeps every pane inside the row in fillViewport mode', () => {
    const {getByTestId} = renderSwiper(true);

    const rowWidth = flat(getByTestId('range-swiper-row').props.style).width;
    const paneWidth = flat(getByTestId(PANE_TEST_IDS[0]).props.style).width;

    // panes are laid out left to right at 0, paneWidth, 2 * paneWidth
    PANE_TEST_IDS.forEach((_, index) => {
      expect((index + 1) * paneWidth).toBeLessThanOrEqual(rowWidth);
    });
  });

  it('still lets the row take its natural height when the outer ScrollView owns scrolling', () => {
    const {getByTestId} = renderSwiper(false);

    const rowStyle = flat(getByTestId('range-swiper-row').props.style);

    // GH-356/GH-324: without fillViewport the row must stay auto-sized so the
    // scrollable area ends at the active pane instead of the tallest neighbour.
    expect(rowStyle.width).toBeUndefined();
    expect(rowStyle.flex).toBeUndefined();
    expect(rowStyle.alignItems).toBe('flex-start');
  });
});

describe('RangeSwiper — which pane is the active one (PERF-003)', () => {
  it('tells nodeFunction that only the pane the user is on is active', () => {
    const calls: {[range: number]: boolean} = {};
    render(
      <RangeSwiper<number>
        fillViewport
        startValue={5}
        determineValueByIndex={(index, range) => range + index}
        nodeFunction={(range, _setRange, isActivePane) => {
          calls[range] = isActivePane;
          return <Text>{`pane ${range}`}</Text>;
        }}
      />,
    );
    expect(calls).toEqual({4: false, 5: true, 6: false});
  });

  it('marks exactly one pane active even when a neighbour shows the same value (edge of the range)', () => {
    const active: boolean[] = [];
    render(
      <RangeSwiper<number>
        fillViewport
        startValue={1}
        // clamped like a meso edge: the previous neighbour of 1 is 1 again
        determineValueByIndex={(index, range) => Math.max(1, range + index)}
        nodeFunction={(_range, _setRange, isActivePane) => {
          active.push(isActivePane);
          return <Text>pane</Text>;
        }}
      />,
    );
    expect(active.filter(Boolean)).toHaveLength(1);
  });
});

describe('RangeSwiper — panes keep their place in the row (PERF-003)', () => {
  it('renders upper, middle, lower in that fixed order, each in its own slot (no translation before any swipe)', () => {
    const {getByTestId, toJSON} = renderSwiper(true);
    const row = getByTestId('range-swiper-row');
    const order = (row.children as any[]).map((child) => child.props.testID);
    expect(order).toEqual(PANE_TEST_IDS);
    PANE_TEST_IDS.forEach((testID) => {
      const translate = flat(getByTestId(testID).props.style).transform;
      expect(translate).toEqual([{translateX: 0}]);
    });
    expect(toJSON()).toBeTruthy();
  });
});
