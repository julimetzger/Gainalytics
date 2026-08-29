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
