import React, {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {MultiselectDropdown} from 'sharingan-rn-modal-dropdown';
import TrainingElementPicker from '../../../../app/components/picker/elements/TrainingElementPicker';
import {useAlleExercises} from '../../../../app/redux/Exercises/use/useAllExercises';
import {useAllTrainingsPlans} from '../../../../app/redux/Training/use/useAllTrainingsPlans';
import {Exercise} from '../../../../app/models/entities/Exercise';

/**
 * GH-401 (H3): after picking the first entry the option list went blank and a
 * subsequent search returned 0 hits, although the same search returned matches
 * before the pick. This spec drives the REAL library component — the sibling
 * TrainingElementPicker.spec.tsx mocks it away, so it can never see this.
 */

jest.mock('../../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(),
}));
jest.mock('../../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

const EXERCISES: Exercise[] = [
  {id: 1, name: 'Bench press'},
  {id: 2, name: 'Squat'},
  {id: 3, name: 'Front squat'},
  {id: 4, name: 'Bulgarian split squat'},
  {id: 5, name: 'Deadlift'},
];
const LABELS = EXERCISES.map((exercise) => exercise.name);
const SQUAT_HITS = ['Bulgarian split squat', 'Front squat', 'Squat'];

const openDropdown = (label: string) => {
  // paper renders the label twice (outline placeholder + floating label);
  // pressing either one reaches the wrapping PressableTouch.
  fireEvent.press(screen.getAllByText(label)[0]);
};

const visibleOptionLabels = (): string[] => LABELS.filter((label) => screen.queryAllByText(label).length > 0);

const searchFor = (query: string) => {
  // The library passes no testID to paper's Searchbar, so match it by type.
  fireEvent.changeText(screen.UNSAFE_getAllByType(require('react-native-paper').Searchbar)[0], query);
};

describe('MultiselectDropdown option list (GH-401 H3)', () => {
  const Harness = () => {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <PaperProvider>
        <MultiselectDropdown label="Select Exercises" enableSearch value={selected} data={EXERCISES.map((exercise) => ({label: exercise.name, value: String(exercise.id)}))} disableSort={false} hideChip onChange={(next: string[]) => setSelected(next)} />
      </PaperProvider>
    );
  };

  it('keeps the option list populated after the first selection', () => {
    render(<Harness />);
    openDropdown('Select Exercises');

    expect(visibleOptionLabels()).toHaveLength(LABELS.length);

    fireEvent.press(screen.getByText('Bench press'));

    expect(visibleOptionLabels()).toHaveLength(LABELS.length);
  });

  it('returns the same search hits before and after a selection', () => {
    render(<Harness />);
    openDropdown('Select Exercises');

    searchFor('squat');
    expect(visibleOptionLabels().sort()).toEqual([...SQUAT_HITS].sort());

    searchFor('');
    fireEvent.press(screen.getByText('Bench press'));

    searchFor('squat');
    expect(visibleOptionLabels().sort()).toEqual([...SQUAT_HITS].sort());
  });

  it('does not mutate the caller-owned value array when an entry is deselected', () => {
    const value = ['1', '2'];
    const onChange = jest.fn();

    render(
      <PaperProvider>
        <MultiselectDropdown label="Select Exercises" enableSearch value={value} data={EXERCISES.map((exercise) => ({label: exercise.name, value: String(exercise.id)}))} disableSort={false} hideChip onChange={onChange} />
      </PaperProvider>,
    );
    openDropdown('Select Exercises');
    fireEvent.press(screen.getByText('Bench press'));

    expect(onChange).toHaveBeenCalledWith(['2']);
    // The parent memoizes this array (TrainingElementPicker.selectedValues) —
    // mutating it in place corrupts the memo for every later render.
    expect(value).toEqual(['1', '2']);
  });
});

describe('TrainingElementPicker exercise list (GH-401 H3)', () => {
  const PickerHarness = () => {
    const [selected, setSelected] = useState<Exercise[]>([]);
    return (
      <PaperProvider>
        <TrainingElementPicker exercise={selected} setExercise={setSelected} dropdownLabel="Select Exercises for your Training" hideChip visible />
      </PaperProvider>
    );
  };

  beforeEach(() => {
    // Redux selectors hand back a fresh array whenever the store changes, which
    // is exactly what a pick does (it writes the training's exercise list).
    jest.mocked(useAlleExercises).mockImplementation(() => [...EXERCISES]);
    jest.mocked(useAllTrainingsPlans).mockImplementation(() => []);
  });

  it('keeps the list usable after the first pick', () => {
    render(<PickerHarness />);
    openDropdown('Select Exercises for your Training');

    searchFor('squat');
    expect(visibleOptionLabels().sort()).toEqual([...SQUAT_HITS].sort());
    searchFor('');

    fireEvent.press(screen.getByText('Bench press'));

    expect(visibleOptionLabels()).toHaveLength(LABELS.length);
    searchFor('squat');
    expect(visibleOptionLabels().sort()).toEqual([...SQUAT_HITS].sort());
  });
});
