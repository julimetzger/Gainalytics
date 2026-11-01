/**
 * GH-458 round 2 (review #3): a positive delta was rendered in a hardcoded
 * '#558b2f' green regardless of theme, which does not adapt to dark theme or
 * a custom palette. The colour must come from the active theme.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {PaperProvider, MD3DarkTheme, MD3LightTheme} from 'react-native-paper';
import MetricView from '../../../app/components/analyse/MetricComparison';
import {Metric} from '../../../app/models/Metric';

const HARDCODED_GREEN = '#558b2f';

// RN's style prop can be an arbitrarily nested array; later entries for the
// same key win, matching StyleSheet.flatten's semantics.
const flattenedColor = (style: unknown): string | undefined => {
  let color: string | undefined;
  const walk = (s: unknown) => {
    if (Array.isArray(s)) {
      s.forEach(walk);
    } else if (s && typeof s === 'object' && 'color' in s) {
      color = (s as {color?: string}).color ?? color;
    }
  };
  walk(style);
  return color;
};

describe('MetricComparison delta colour (GH-458 round 2, review #3)', () => {
  it('uses the theme primary colour for a positive delta, in light theme', () => {
    const {getByTestId} = render(
      <PaperProvider theme={MD3LightTheme}>
        <MetricView comparison={{value: 10, difference: 2}} metric={Metric.SETS} testID="delta" />
      </PaperProvider>,
    );

    const flatColor = flattenedColor(getByTestId('delta-delta').props.style);
    expect(flatColor).toBe(MD3LightTheme.colors.primary);
    expect(flatColor).not.toBe(HARDCODED_GREEN);
  });

  it('uses the theme primary colour for a positive delta, in dark theme (review requires dark-theme evidence)', () => {
    const {getByTestId} = render(
      <PaperProvider theme={MD3DarkTheme}>
        <MetricView comparison={{value: 10, difference: 2}} metric={Metric.SETS} testID="delta" />
      </PaperProvider>,
    );

    const flatColor = flattenedColor(getByTestId('delta-delta').props.style);
    expect(flatColor).toBe(MD3DarkTheme.colors.primary);
    expect(flatColor).not.toBe(HARDCODED_GREEN);
    expect(flatColor).not.toBe(MD3LightTheme.colors.primary);
  });

  it('still uses the theme error colour for a negative delta', () => {
    const {getByTestId} = render(
      <PaperProvider theme={MD3DarkTheme}>
        <MetricView comparison={{value: 10, difference: -2}} metric={Metric.SETS} testID="delta" />
      </PaperProvider>,
    );

    const flatColor = flattenedColor(getByTestId('delta-delta').props.style);
    expect(flatColor).toBe(MD3DarkTheme.colors.error);
  });
});

describe('MetricComparison without a value (GH-527)', () => {
  it('shows "–" and no delta for a muscle that has no 1RM of its own', () => {
    const {getByTestId, queryByTestId} = render(
      <PaperProvider theme={MD3LightTheme}>
        <MetricView comparison={{value: undefined, difference: undefined}} metric={Metric.ONE_RM} section="muscles" testID="cell" />
      </PaperProvider>,
    );

    expect({value: getByTestId('cell').props.children, delta: queryByTestId('cell-delta')}).toEqual({value: '–', delta: null});
  });
});
