const MILLISECONDS_IN_MINUTE = 1000 * 60;

type TrainingTimeValue = Date | number | string;

export const toTrainingDate = (value: TrainingTimeValue) => new Date(value);

export const getTrainingTimeValidationError = (start: TrainingTimeValue, end: TrainingTimeValue) => {
  if (toTrainingDate(end).getTime() < toTrainingDate(start).getTime()) {
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
