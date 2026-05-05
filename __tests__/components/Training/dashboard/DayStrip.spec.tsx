import React from 'react';
import {render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import DayStrip, {DayStripDay} from '../../../../app/components/Training/dashboard/DayStrip';

const buildWeek = (overrides: Partial<Record<number, Partial<DayStripDay>>> = {}): DayStripDay[] => {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return letters.map<DayStripDay>((weekday, i) => {
    const dayOfMonth = 4 + i;
    return {
      weekday,
      dayOfMonth,
      status: 'future',
      isoDate: `2026-05-${String(dayOfMonth).padStart(2, '0')}`,
      ...(overrides[i] ?? {}),
    };
  });
};

const renderStrip = (days: DayStripDay[]) =>
  render(
    <PaperProvider>
      <DayStrip days={days} />
    </PaperProvider>,
  );

describe('DayStrip', () => {
  it('renders nothing for an empty list', () => {
    const {queryByTestId} = renderStrip([]);
    expect(queryByTestId('day-strip')).toBeNull();
  });

  it('emits a day-pill testID with status suffix per day', () => {
    const days = buildWeek({
      0: {status: 'done'},
      4: {status: 'today'},
    });
    const {getByTestId} = renderStrip(days);
    expect(getByTestId('day-strip')).toBeTruthy();
    expect(getByTestId('day-pill-2026-05-04-done')).toBeTruthy();
    expect(getByTestId('day-pill-2026-05-08-today')).toBeTruthy();
    expect(getByTestId('day-pill-2026-05-10-future')).toBeTruthy();
  });

  it('renders the day-of-month for non-done statuses', () => {
    const days = buildWeek({
      4: {status: 'today', dayOfMonth: 8},
      6: {status: 'future', dayOfMonth: 10},
    });
    const {getAllByText} = renderStrip(days);
    expect(getAllByText('8').length).toBeGreaterThan(0);
    expect(getAllByText('10').length).toBeGreaterThan(0);
  });

  it('hides the day number on done days (replaced by checkmark icon)', () => {
    const days = buildWeek({
      0: {status: 'done', dayOfMonth: 4},
      1: {status: 'past', dayOfMonth: 5},
    });
    const {queryAllByText} = renderStrip(days);
    // Past day number is rendered, done day's number is replaced by the check icon.
    expect(queryAllByText('5').length).toBeGreaterThan(0);
    expect(queryAllByText('4').length).toBe(0);
  });
});
