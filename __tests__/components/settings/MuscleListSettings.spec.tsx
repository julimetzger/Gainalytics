import React from 'react';
import {fireEvent, render, within} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import rootReducer from '../../../app/redux/rootReducer';
import MuscleListSettings from '../../../app/components/settings/MuscleListSettings';
import MuscleInvolvementEditor from '../../../app/components/exercise/add/MuscleInvolvementEditor';

// jest.setup.js stubs useSelector globally; this spec drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const renderWithStore = () => {
  const store = createStore(rootReducer);
  const utils = render(
    <Provider store={store}>
      <PaperProvider>
        <MuscleListSettings />
        <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />
      </PaperProvider>
    </Provider>,
  );
  fireEvent.press(utils.getByTestId('settings-muscles-accordion'));
  return {store, ...utils};
};

const editorMuscles = (getByTestId: (id: string) => any) =>
  within(getByTestId('muscle-involvement-editor'))
    .getAllByTestId(/^muscle-row-/)
    .map((row) => String(row.props.testID).replace('muscle-row-', ''));

describe('MuscleListSettings (GH-523)', () => {
  it('lists the built-in muscles alphabetically, all shown in the overviews', () => {
    const {getAllByTestId, getByText} = renderWithStore();

    expect(getAllByTestId(/^settings-muscle-row-/).map((row) => row.props.testID)).toEqual([
      'settings-muscle-row-Back',
      'settings-muscle-row-Biceps',
      'settings-muscle-row-Chest',
      'settings-muscle-row-Core',
      'settings-muscle-row-Glutes',
      'settings-muscle-row-Hamstrings',
      'settings-muscle-row-Quads',
      'settings-muscle-row-Shoulders',
      'settings-muscle-row-Triceps',
    ]);
    expect(getAllByTestId(/^settings-muscle-overview-/).map((toggle) => toggle.props.value)).toEqual(Array(9).fill(true));
    expect(getByText('9 muscles · 9 shown in overviews')).toBeTruthy();
  });

  it('adds a muscle, which the exercise editor then offers', () => {
    const {store, getByTestId, getByText} = renderWithStore();

    fireEvent.changeText(getByTestId('settings-muscle-name-input'), '  Calves ');
    fireEvent.press(getByTestId('settings-muscle-add-button'));

    expect(store.getState().settings.muscles).toEqual({custom: ['Calves'], hiddenInOverviews: []});
    expect(getByTestId('settings-muscle-row-Calves')).toBeTruthy();
    expect(getByText('10 muscles · 10 shown in overviews')).toBeTruthy();
    expect(editorMuscles(getByTestId)).toEqual(['Back', 'Biceps', 'Calves', 'Chest', 'Core', 'Glutes', 'Hamstrings', 'Quads', 'Shoulders', 'Triceps']);
  });

  it('rejects a duplicate name with a message and adds nothing', () => {
    const {store, getByTestId, getByText} = renderWithStore();

    fireEvent.changeText(getByTestId('settings-muscle-name-input'), 'chest');
    fireEvent.press(getByTestId('settings-muscle-add-button'));

    expect(getByText('Chest already exists.')).toBeTruthy();
    expect(store.getState().settings.muscles).toBeUndefined();
  });

  it('hides a muscle from the overviews with its switch', () => {
    const {store, getByTestId, getByText} = renderWithStore();

    fireEvent(getByTestId('settings-muscle-overview-Biceps'), 'valueChange', false);

    expect(store.getState().settings.muscles).toEqual({hiddenInOverviews: ['Biceps']});
    expect(getByTestId('settings-muscle-overview-Biceps').props.value).toBe(false);
    expect(getByText('9 muscles · 8 shown in overviews')).toBeTruthy();
    // Hiding only affects the overviews: exercises can still be assigned to it.
    expect(editorMuscles(getByTestId)).toContain('Biceps');
  });

  it('removes a muscle after confirming, also from the exercises and the editor', () => {
    const {store, getByTestId, getByText, queryByTestId} = renderWithStore();

    fireEvent.press(getByTestId('settings-muscle-remove-Biceps'));
    // Five of the default exercises train Biceps.
    expect(getByText('Biceps is assigned to 5 exercises. Removing it also removes it from those exercises.')).toBeTruthy();
    fireEvent.press(getByTestId('settings-muscle-remove-confirm'));

    expect(store.getState().settings.muscles).toEqual({removed: ['Biceps'], hiddenInOverviews: []});
    expect(queryByTestId('settings-muscle-row-Biceps')).toBeNull();
    expect(editorMuscles(getByTestId)).not.toContain('Biceps');
    const exercises = Object.values(store.getState().exercises.byId);
    expect(exercises.filter((exercise) => exercise.muscles?.some((pair) => pair.muscle === 'Biceps'))).toEqual([]);
  });

  it('cancelling the removal keeps the muscle', () => {
    const {store, getByTestId} = renderWithStore();

    fireEvent.press(getByTestId('settings-muscle-remove-Core'));
    fireEvent.press(getByTestId('settings-muscle-remove-cancel'));

    expect(store.getState().settings.muscles).toBeUndefined();
    expect(getByTestId('settings-muscle-row-Core')).toBeTruthy();
  });
});
