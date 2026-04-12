import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Training} from '../../../models/entities/Training';

/**
 * Returns all trainings whose end date falls within the last `days` days,
 * across all training plans and micros.
 */
export const useTrainingsInLastDays = (days: number): Training[] =>
  useSelector((state: GlobalState) => {
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    return state.trainings.allIds
      .map((id: number) => state.trainings.byId[id])
      .filter(
        (t): t is Training =>
          t !== undefined &&
          t.end !== undefined &&
          t.end !== null &&
          new Date(t.end).getTime() >= cutoff,
      );
  });
