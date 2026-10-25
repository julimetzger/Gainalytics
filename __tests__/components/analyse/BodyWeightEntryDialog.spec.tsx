import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import BodyWeightEntryDialog from '../../../app/components/analyse/BodyWeightEntryDialog';

global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

// The real picker opens a calendar modal; the stub shows the label the button would show and lets the test pick a day.
jest.mock('../../../app/components/picker/date/DatePicker', () => {
  const React = require('react');
  const {Pressable, Text} = require('react-native');
  const {getDateStringFromDate} = require('../../../app/utils/DateHelper');

  return ({date, setDate, testID}: {date: Date | number; setDate: (date: Date) => void; testID?: string}) => (
    <Pressable testID={testID} onPress={() => setDate(new Date(2026, 9, 5, 9, 30))}>
      <Text testID={`${testID}-label`}>{getDateStringFromDate(new Date(date))}</Text>
    </Pressable>
  );
});

describe('BodyWeightEntryDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 23, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderDialog = (props: Partial<React.ComponentProps<typeof BodyWeightEntryDialog>> = {}) => {
    const onSave = jest.fn();
    render(
      <PaperProvider>
        <BodyWeightEntryDialog visible onDismiss={jest.fn()} onSave={onSave} {...props} />
      </PaperProvider>,
    );
    return onSave;
  };

  it('prefills today in the app date format and saves the picked day', () => {
    const onSave = renderDialog();

    expect(screen.getByTestId('body-weight-date-button-label').props.children).toBe('Fri, 23/10/26');

    fireEvent.press(screen.getByTestId('body-weight-date-button'));
    expect(screen.getByTestId('body-weight-date-button-label').props.children).toBe('Mon, 05/10/26');

    fireEvent.changeText(screen.getByTestId('body-weight-weight-input'), '81.4');
    fireEvent.press(screen.getByTestId('body-weight-save'));

    expect(onSave).toHaveBeenCalledWith({date: new Date(2026, 9, 5).getTime(), weightKg: 81.4});
  });

  it('accepts a comma as decimal separator but always shows a dot', () => {
    const onSave = renderDialog();

    fireEvent.changeText(screen.getByTestId('body-weight-weight-input'), '82,5');
    expect(screen.getByTestId('body-weight-weight-input').props.value).toBe('82.5');

    fireEvent.press(screen.getByTestId('body-weight-save'));
    expect(onSave).toHaveBeenCalledWith({date: new Date(2026, 9, 23).getTime(), weightKg: 82.5});
  });

  it('shows the stored weight of an edited entry with a dot', () => {
    renderDialog({entry: {id: 1, date: new Date(2026, 8, 20).getTime(), weightKg: 82.5}});

    expect(screen.getByTestId('body-weight-weight-input').props.value).toBe('82.5');
    expect(screen.getByTestId('body-weight-date-button-label').props.children).toBe('Sun, 20/09/26');
  });
});
