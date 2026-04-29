import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import DropdownChip from '../../../app/components/shared/DropdownChip';

const renderWithPaper = (ui: React.ReactElement) =>
  render(<PaperProvider>{ui}</PaperProvider>);

type Compare = 'none' | 'last_plan' | 'current_total_plan';

const baseOptions = [
  {value: 'none' as Compare, label: 'None'},
  {value: 'last_plan' as Compare, label: 'Micro 3 plan'},
  {value: 'current_total_plan' as Compare, label: 'Current micro plan'},
];

describe('DropdownChip', () => {
  it('renders the selected option label', () => {
    const {getByText} = renderWithPaper(
      <DropdownChip<Compare>
        testID="compare-chip"
        value="current_total_plan"
        options={baseOptions}
        onChange={jest.fn()}
      />,
    );
    expect(getByText('Current micro plan')).toBeTruthy();
  });

  it('opens menu on chip tap and shows all options', () => {
    const {getByTestId, getAllByText} = renderWithPaper(
      <DropdownChip<Compare>
        testID="compare-chip"
        value="none"
        options={baseOptions}
        onChange={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('compare-chip'));
    // Each option label appears as a Menu.Item title; "None" also appears in the chip → expect 1+ instances
    expect(getAllByText('Current micro plan').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Micro 3 plan').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onChange when a selectable option is pressed', () => {
    const onChange = jest.fn();
    const {getByTestId} = renderWithPaper(
      <DropdownChip<Compare>
        testID="compare-chip"
        value="none"
        options={baseOptions}
        onChange={onChange}
      />,
    );
    fireEvent.press(getByTestId('compare-chip'));
    fireEvent.press(getByTestId('compare-chip-option-current_total_plan'));
    expect(onChange).toHaveBeenCalledWith('current_total_plan');
  });

  it('does NOT call onChange for a disabled option', () => {
    const onChange = jest.fn();
    const optionsWithDisabled = [
      ...baseOptions.slice(0, 1),
      {value: 'last_plan' as Compare, label: 'No previous plan', disabled: true},
      ...baseOptions.slice(2),
    ];
    const {getByTestId} = renderWithPaper(
      <DropdownChip<Compare>
        testID="compare-chip"
        value="none"
        options={optionsWithDisabled}
        onChange={onChange}
      />,
    );
    fireEvent.press(getByTestId('compare-chip'));
    fireEvent.press(getByTestId('compare-chip-option-last_plan'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
