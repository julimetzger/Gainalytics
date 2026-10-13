import React from 'react';
import {Text} from 'react-native';
import {act, render} from '@testing-library/react-native';
import {PROGRESSIVE_STAGE_MS, ProgressiveMount, Stage, useProgressiveLimit} from '../../../app/components/common/ProgressiveMount';

const List = ({count}: {count: number}) => {
  const limit = useProgressiveLimit(2);
  return (
    <>
      {Array.from({length: count})
        .slice(0, limit)
        .map((_, i) => (
          <Text key={i} testID={`item-${i}`}>{`item ${i}`}</Text>
        ))}
    </>
  );
};

describe('ProgressiveMount (PERF-003)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders everything at once outside a ProgressiveMount', () => {
    const {queryByTestId} = render(
      <>
        <List count={7} />
        <Stage at={2}>
          <Text testID="late">late</Text>
        </Stage>
      </>,
    );
    expect(queryByTestId('item-6')).toBeTruthy();
    expect(queryByTestId('late')).toBeTruthy();
  });

  it('adds a slice per stage, each in its own commit, until everything is there', () => {
    const {queryByTestId} = render(
      <ProgressiveMount stages={3}>
        <List count={7} />
        <Stage at={1}>
          <Text testID="mid">mid</Text>
        </Stage>
        <Stage at={2}>
          <Text testID="late">late</Text>
        </Stage>
      </ProgressiveMount>,
    );
    // stage 0: first slice only
    expect(queryByTestId('item-1')).toBeTruthy();
    expect(queryByTestId('item-2')).toBeNull();
    expect(queryByTestId('mid')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(PROGRESSIVE_STAGE_MS);
    });
    expect(queryByTestId('item-3')).toBeTruthy();
    expect(queryByTestId('item-4')).toBeNull();
    expect(queryByTestId('mid')).toBeTruthy();
    expect(queryByTestId('late')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(PROGRESSIVE_STAGE_MS);
    });
    expect(queryByTestId('item-5')).toBeTruthy();
    // GH-418: the last stage is not one more slice — it shows everything. With a
    // slice per stage this list would have stopped at 6 of its 7 items.
    expect(queryByTestId('item-6')).toBeTruthy();
    expect(queryByTestId('late')).toBeTruthy();
    // the last stage is reached: no timer left running
    expect(jest.getTimerCount()).toBe(0);
  });

  it('never caps a long list (GH-418: the 11th exercise of a plan)', () => {
    const {queryByTestId} = render(
      <ProgressiveMount>
        <List count={30} />
      </ProgressiveMount>,
    );
    // Each stage's timer is only set after the previous stage rendered.
    for (let stage = 0; stage < 10; stage += 1) {
      act(() => {
        jest.advanceTimersByTime(PROGRESSIVE_STAGE_MS);
      });
    }
    expect(queryByTestId('item-10')).toBeTruthy();
    expect(queryByTestId('item-29')).toBeTruthy();
  });
});
