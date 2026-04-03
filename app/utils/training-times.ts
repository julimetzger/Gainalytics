const MILLISECONDS_IN_MINUTE = 1000 * 60;

type TrainingTimeValue = Date | number | string;
const FULL_DATE_TIME_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+(\d{1,2}):(\d{2})$/;
const TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})$/;

export const toTrainingDate = (value: TrainingTimeValue) => new Date(value);

const isValidDatePart = (date: Date, year: number, month: number, day: number, hours: number, minutes: number) =>
  date.getFullYear() === year &&
  date.getMonth() === month - 1 &&
  date.getDate() === day &&
  date.getHours() === hours &&
  date.getMinutes() === minutes;

const buildValidatedDate = (year: number, month: number, day: number, hours: number, minutes: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const candidate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (!isValidDatePart(candidate, year, month, day, hours, minutes)) {
    return null;
  }

  return candidate;
};

const padDateValue = (value: number) => String(value).padStart(2, '0');

export const formatTrainingTimeInput = (value: TrainingTimeValue) => {
  const date = toTrainingDate(value);

  return `${padDateValue(date.getDate())}/${padDateValue(date.getMonth() + 1)}/${date.getFullYear()} ${padDateValue(date.getHours())}:${padDateValue(date.getMinutes())}`;
};

export const parseTrainingTimeInput = (value: string, fallbackDate: TrainingTimeValue) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const fullDateTimeMatch = normalizedValue.match(FULL_DATE_TIME_PATTERN);
  if (fullDateTimeMatch) {
    const [, day, month, year, hours, minutes] = fullDateTimeMatch;
    return buildValidatedDate(Number(year), Number(month), Number(day), Number(hours), Number(minutes));
  }

  const timeOnlyMatch = normalizedValue.match(TIME_ONLY_PATTERN);
  if (timeOnlyMatch) {
    const [, hours, minutes] = timeOnlyMatch;
    const currentDate = toTrainingDate(fallbackDate);

    return buildValidatedDate(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), Number(hours), Number(minutes));
  }

  return null;
};

export const getTrainingTimeInputError = (value: string, fallbackDate: TrainingTimeValue) =>
  parseTrainingTimeInput(value, fallbackDate) === null ? 'Use HH:mm or DD/MM/YYYY HH:mm.' : null;

export const getTrainingTimeValidationError = (start: TrainingTimeValue, end: TrainingTimeValue) => {
  const startTime = toTrainingDate(start).getTime();
  const endTime = toTrainingDate(end).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return 'Enter a valid date and time.';
  }

  if (endTime < startTime) {
    return 'End time cannot be before start time.';
  }

  return null;
};

export const getTrainingDurationMinutes = (start: TrainingTimeValue, end: TrainingTimeValue): number | null => {
  if (getTrainingTimeValidationError(start, end)) {
    return null;
  }

  return (toTrainingDate(end).getTime() - toTrainingDate(start).getTime()) / MILLISECONDS_IN_MINUTE;
};
