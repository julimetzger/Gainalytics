import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {MD3DarkTheme, MD3LightTheme, PaperProvider} from 'react-native-paper';
import AnalysisDataToggle, {AnalysisDataMode} from '../../../../app/components/Training/analyse/AnalysisDataToggle';

// The toggle is rendered against the REAL react-native-paper: mocking the
// library away would hide exactly the thing under test here — that the control
// is built from Paper's SegmentedButtons and takes its colours from the theme
// (agent-memory #319).
const renderToggle = (value: AnalysisDataMode, onChange: (mode: AnalysisDataMode) => void, theme = MD3LightTheme) =>
  render(
    <PaperProvider theme={theme}>
      <AnalysisDataToggle value={value} onChange={onChange} />
    </PaperProvider>,
  );

describe('AnalysisDataToggle (GH-417)', () => {
  it('renders both positions', () => {
    const {getByTestId, getByText} = renderToggle('train', jest.fn());

    expect(getByTestId('analysis-data-plan')).toBeTruthy();
    expect(getByTestId('analysis-data-train')).toBeTruthy();
    expect(getByText('Plan')).toBeTruthy();
    expect(getByText('Train')).toBeTruthy();
  });

  it('is built from Paper SegmentedButtons, not from hand-rolled Pressables', () => {
    const {getByTestId} = renderToggle('train', jest.fn());

    // Paper's SegmentedButtonItem renders the label under `${testID}-label` and
    // puts the touch handling on a TouchableRipple that carries the plain
    // testID. Both only exist when the segment really is a Paper segment.
    expect(getByTestId('analysis-data-plan-label').props.children).toBe('Plan');
    expect(getByTestId('analysis-data-train-label').props.children).toBe('Train');
    expect(getByTestId('analysis-data-plan').props.accessibilityRole).toBe('button');
  });

  it('marks the current position as checked — Train is the start position', () => {
    const {getByTestId} = renderToggle('train', jest.fn());

    expect(getByTestId('analysis-data-train').props.accessibilityState).toEqual({checked: true, disabled: false});
    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({checked: false, disabled: false});
  });

  it('moves the selection marker with the value', () => {
    const {getByTestId} = renderToggle('plan', jest.fn());

    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({checked: true, disabled: false});
    expect(getByTestId('analysis-data-train').props.accessibilityState).toEqual({checked: false, disabled: false});
  });

  it('names each position for screen readers', () => {
    const {getByTestId} = renderToggle('train', jest.fn());

    expect(getByTestId('analysis-data-plan').props.accessibilityLabel).toBe('Show Plan data');
    expect(getByTestId('analysis-data-train').props.accessibilityLabel).toBe('Show Train data');
  });

  it('reports the pressed position to its owner', () => {
    const onChange = jest.fn<void, [AnalysisDataMode]>();
    const {getByTestId} = renderToggle('train', onChange);

    fireEvent.press(getByTestId('analysis-data-plan'));
    expect(onChange).toHaveBeenCalledWith('plan');

    fireEvent.press(getByTestId('analysis-data-train'));
    expect(onChange).toHaveBeenLastCalledWith('train');
  });

  it('takes the checked segment colour from the active theme instead of a hardcoded value', () => {
    const labelColor = (result: ReturnType<typeof renderToggle>, testID: string) =>
      StyleSheet.flatten(result.getByTestId(testID).props.style).color;

    const light = renderToggle('train', jest.fn(), MD3LightTheme);
    const lightLabelColor = labelColor(light, 'analysis-data-train-label');
    expect(lightLabelColor).toBe(MD3LightTheme.colors.onSecondaryContainer);

    const dark = renderToggle('train', jest.fn(), MD3DarkTheme);
    const darkLabelColor = labelColor(dark, 'analysis-data-train-label');
    expect(darkLabelColor).toBe(MD3DarkTheme.colors.onSecondaryContainer);

    // the two themes must not resolve to the same colour, otherwise the
    // assertion above would also pass for a hardcoded value
    expect(lightLabelColor).not.toBe(darkLabelColor);
  });
});
