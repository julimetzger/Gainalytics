import React from 'react';
import {Text, View} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import AnalyseErrorBoundary, {withAnalyseErrorBoundary} from '../../../app/components/analyse/AnalyseErrorBoundary';

/**
 * GH-458 (H1): a render error inside one Analyse screen used to unmount the
 * whole navigation tree — the user was left on a white screen with no drawer
 * and no way back except the task switcher.
 */

let shouldThrow = true;

const BrokenScreen = () => {
  if (shouldThrow) {
    throw new TypeError("Cannot read property 'analysisId' of undefined");
  }
  return <Text testID="broken-screen-content">recovered content</Text>;
};

// The boundary logs through console.warn/console.error on purpose; silence the
// noise so a passing run stays readable.
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  shouldThrow = true;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const renderWithPaper = (node: React.ReactElement) => render(<PaperProvider>{node}</PaperProvider>);

describe('AnalyseErrorBoundary (GH-458 H1)', () => {
  it('renders children untouched while nothing throws', () => {
    shouldThrow = false;

    const {getByTestId, queryByTestId} = renderWithPaper(
      <AnalyseErrorBoundary screenName="Video Analysis Detail">
        <BrokenScreen />
      </AnalyseErrorBoundary>,
    );

    expect(getByTestId('broken-screen-content')).toBeTruthy();
    expect(queryByTestId('analyse-error-boundary')).toBeNull();
  });

  it('replaces only the failing screen and leaves the surrounding navigation rendered', () => {
    const {getByTestId, queryByTestId} = renderWithPaper(
      <View>
        <Text testID="analyse-drawer-toggle">menu</Text>
        <AnalyseErrorBoundary screenName="Video Analysis Detail">
          <BrokenScreen />
        </AnalyseErrorBoundary>
      </View>,
    );

    // The screen body degraded to the fallback card …
    expect(getByTestId('analyse-error-boundary')).toBeTruthy();
    expect(getByTestId('analyse-error-boundary-message')).toBeTruthy();
    expect(queryByTestId('broken-screen-content')).toBeNull();

    // … while the navigation chrome around it is still mounted and usable,
    // which is what makes the area recoverable without an app restart.
    expect(getByTestId('analyse-drawer-toggle')).toBeTruthy();
  });

  it('names the failing screen and recovers when "Try again" is tapped', () => {
    const {getByTestId, queryByTestId, getByText} = renderWithPaper(
      <AnalyseErrorBoundary screenName="Video Analysis Detail">
        <BrokenScreen />
      </AnalyseErrorBoundary>,
    );

    expect(getByText('Video Analysis Detail could not be displayed')).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(getByTestId('analyse-error-boundary-retry'));

    expect(getByTestId('broken-screen-content')).toBeTruthy();
    expect(queryByTestId('analyse-error-boundary')).toBeNull();
  });

  it('withAnalyseErrorBoundary forwards navigation props and still catches', () => {
    shouldThrow = false;
    const Screen = ({route}: any) => <Text testID="wrapped-screen">{route.params.analysisId}</Text>;
    const WrappedScreen = withAnalyseErrorBoundary(Screen, 'Video Analysis Detail');

    const {getByTestId} = renderWithPaper(<WrappedScreen route={{params: {analysisId: 42}}} />);

    expect(getByTestId('wrapped-screen').props.children).toBe(42);
  });

  it('withAnalyseErrorBoundary catches the exact TypeError the drawer entry used to raise', () => {
    const Screen = ({route}: any) => <Text testID="wrapped-screen">{route.params.analysisId}</Text>;
    const WrappedScreen = withAnalyseErrorBoundary(Screen, 'Video Analysis Detail');

    const {getByTestId, queryByTestId} = renderWithPaper(<WrappedScreen route={{}} />);

    expect(getByTestId('analyse-error-boundary')).toBeTruthy();
    expect(queryByTestId('wrapped-screen')).toBeNull();
  });
});
