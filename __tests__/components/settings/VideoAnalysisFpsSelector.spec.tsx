/**
 * GH-621: Settings → Video analysis → "Analysis frame rate" (15 / 20 / 30 FPS, default 30).
 */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {PaperProvider} from 'react-native-paper';
import rootReducer from '../../../app/redux/rootReducer';
import VideoAnalysisFpsSelector from '../../../app/components/settings/VideoAnalysisFpsSelector';

jest.mock('react-redux', () => jest.requireActual('react-redux'));

const renderSelector = () => {
  const store = configureStore({reducer: rootReducer});
  const screen = render(
    <Provider store={store}>
      <PaperProvider>
        <VideoAnalysisFpsSelector />
      </PaperProvider>
    </Provider>,
  );
  return {store, screen};
};

const checkedStates = (screen: ReturnType<typeof render>) =>
  [15, 20, 30].map((fps) => [fps, screen.getByTestId(`settings-video-analysis-fps-${fps}`).props.accessibilityState?.checked]);

describe('VideoAnalysisFpsSelector (GH-621)', () => {
  it('shows the three choices with 30 FPS selected on a fresh install, plus the helper text', () => {
    const {screen} = renderSelector();

    expect(screen.getByText('Analysis frame rate')).toBeTruthy();
    expect(screen.getAllByText(/^\d+ FPS$/).map((node) => node.props.children)).toEqual(['15 FPS', '20 FPS', '30 FPS']);
    expect(checkedStates(screen)).toEqual([
      [15, false],
      [20, false],
      [30, true],
    ]);
    expect(screen.getByTestId('settings-video-analysis-fps-hint').props.children).toBe(
      'Higher = more precise bar path and velocity, but slower analysis.',
    );
  });

  it('persists the chosen rate in the settings and selects it', () => {
    const {store, screen} = renderSelector();

    fireEvent.press(screen.getByTestId('settings-video-analysis-fps-15'));

    expect(store.getState().settings.videoAnalysisFps).toBe(15);
    expect(checkedStates(screen)).toEqual([
      [15, true],
      [20, false],
      [30, false],
    ]);
  });
});
