import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';

/**
 * Returns finished trainings whose end date falls within [startDate, endDate] (inclusive).
 */
export function filterTrainingsByDateRange(
  trainings: Training[],
  startDate: Date,
  endDate: Date,
): Training[] {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  return trainings.filter(t => {
    if (t.state !== TrainingsState.FINISHED || !t.end) return false;
    const tEnd = new Date(t.end).getTime();
    return tEnd >= startMs && tEnd <= endMs;
  });
}
