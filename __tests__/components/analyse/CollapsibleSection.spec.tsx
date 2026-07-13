import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import {Text} from 'react-native';
import CollapsibleSection from '../../../app/components/analyse/CollapsibleSection';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';

jest.mock('react-redux', () => jest.requireActual('react-redux'));

const baseGlobalState = {
  exercises: {byId: {}, allIds: []},
  workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []},
  trainingsPlan: {byId: {}, allIds: []},
  trainings: {byId: {}, allIds: []},
  videoAnalyses: {byId: {}, allIds: []},
  settings: {mode: 'dark'},
  effects: {},
  aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
} satisfies GlobalState;

const testReducer = (state: GlobalState | undefined, action: AnyAction): GlobalState => rootReducer(state ?? baseGlobalState, action);

describe('CollapsibleSection — real redux toggle (GH-367)', () => {
  it('hides content after tapping the header and shows it again after tapping once more', () => {
    const store = createStore(testReducer, baseGlobalState);

    const {getByTestId, queryByTestId} = render(
      <Provider store={store}>
        <CollapsibleSection id="muscleGroups" title="Muscle Groups">
          <Text testID="section-child">content</Text>
        </CollapsibleSection>
      </Provider>,
    );

    expect(queryByTestId('section-child')).toBeTruthy();

    fireEvent.press(getByTestId('analysis-section-muscleGroups-header'));
    expect(queryByTestId('section-child')).toBeNull();
    expect(store.getState().settings.analysisSectionsCollapsed?.muscleGroups).toBe(true);

    fireEvent.press(getByTestId('analysis-section-muscleGroups-header'));
    expect(queryByTestId('section-child')).toBeTruthy();
    expect(store.getState().settings.analysisSectionsCollapsed?.muscleGroups).toBe(false);
  });

  it('tapping the chevron button toggles the same persisted state as the header row', () => {
    const store = createStore(testReducer, baseGlobalState);

    const {getByTestId, queryByTestId} = render(
      <Provider store={store}>
        <CollapsibleSection id="muscleMap" title="Muscle Map">
          <Text testID="map-child">content</Text>
        </CollapsibleSection>
      </Provider>,
    );

    fireEvent.press(getByTestId('analysis-section-muscleMap-chevron'));
    expect(queryByTestId('map-child')).toBeNull();
    expect(store.getState().settings.analysisSectionsCollapsed?.muscleMap).toBe(true);
  });

  it('collapsed state for one section does not affect another section', () => {
    const store = createStore(testReducer, baseGlobalState);

    const {getByTestId, queryByTestId} = render(
      <Provider store={store}>
        <>
          <CollapsibleSection id="muscleGroups" title="Muscle Groups">
            <Text testID="groups-child">groups</Text>
          </CollapsibleSection>
          <CollapsibleSection id="metrics" title="Metriken">
            <Text testID="metrics-child">metrics</Text>
          </CollapsibleSection>
        </>
      </Provider>,
    );

    fireEvent.press(getByTestId('analysis-section-muscleGroups-header'));
    expect(queryByTestId('groups-child')).toBeNull();
    expect(queryByTestId('metrics-child')).toBeTruthy();
  });
});
