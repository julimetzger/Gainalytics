import {firstDayOfWeek, lastDayOfWeek} from '../DateHelper';

// Week starts Monday (index 1), ends Sunday (index 0)
const FIRST_DAY_INDEX = 1;
const LAST_DAY_INDEX = 0;

// Use `new Date(year, month, day, ...)` to create LOCAL-time dates — avoids UTC/timezone
// ambiguity from ISO string parsing.
//
// Reference week: Mon 2024-01-08 … Sun 2024-01-14
const WEEK_DATES: Array<{dayIndex: number; label: string; date: Date}> = [
  {dayIndex: 1, label: 'Monday',    date: new Date(2024, 0,  8, 12, 0, 0)},
  {dayIndex: 2, label: 'Tuesday',   date: new Date(2024, 0,  9, 12, 0, 0)},
  {dayIndex: 3, label: 'Wednesday', date: new Date(2024, 0, 10, 12, 0, 0)},
  {dayIndex: 4, label: 'Thursday',  date: new Date(2024, 0, 11, 12, 0, 0)},
  {dayIndex: 5, label: 'Friday',    date: new Date(2024, 0, 12, 12, 0, 0)},
  {dayIndex: 6, label: 'Saturday',  date: new Date(2024, 0, 13, 12, 0, 0)},
  {dayIndex: 0, label: 'Sunday',    date: new Date(2024, 0, 14, 12, 0, 0)},
];

/** Returns YYYY-MM-DD using LOCAL date components to avoid UTC offset issues. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('firstDayOfWeek', () => {
  it.each(WEEK_DATES)(
    'returns Monday 2024-01-08 00:00:00.000 when input is $label',
    ({date}) => {
      const result = firstDayOfWeek(date, FIRST_DAY_INDEX);
      expect(localDateStr(result)).toBe('2024-01-08');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    },
  );

  it('does NOT mutate the input Date object', () => {
    const input = new Date(2024, 0, 10, 12, 0, 0); // Wednesday
    const inputTime = input.getTime();
    firstDayOfWeek(input, FIRST_DAY_INDEX);
    expect(input.getTime()).toBe(inputTime);
  });
});

describe('lastDayOfWeek', () => {
  it.each(WEEK_DATES)(
    'returns Sunday 2024-01-14 23:59:59.999 when input is $label',
    ({date}) => {
      const result = lastDayOfWeek(date, LAST_DAY_INDEX);
      expect(localDateStr(result)).toBe('2024-01-14');
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    },
  );

  it('returns the same Sunday when input is already Sunday (no off-by-7)', () => {
    const sunday = new Date(2024, 0, 14, 10, 0, 0); // Sunday
    const result = lastDayOfWeek(sunday, LAST_DAY_INDEX);
    expect(localDateStr(result)).toBe('2024-01-14');
  });

  it('does NOT mutate the input Date object', () => {
    const input = new Date(2024, 0, 14, 10, 0, 0); // Sunday
    const inputTime = input.getTime();
    lastDayOfWeek(input, LAST_DAY_INDEX);
    expect(input.getTime()).toBe(inputTime);
  });
});

describe('firstDayOfWeek + lastDayOfWeek used together (as in DashboardTab)', () => {
  it('does not corrupt the shared `now` variable when called sequentially', () => {
    const now = new Date(2024, 0, 10, 12, 0, 0); // Wednesday
    const nowTime = now.getTime();

    const start = firstDayOfWeek(now, FIRST_DAY_INDEX);
    const end = lastDayOfWeek(now, LAST_DAY_INDEX);

    // now must not have been mutated
    expect(now.getTime()).toBe(nowTime);

    // range should be Mon 2024-01-08 to Sun 2024-01-14
    expect(localDateStr(start)).toBe('2024-01-08');
    expect(localDateStr(end)).toBe('2024-01-14');
  });
});
