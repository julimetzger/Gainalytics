import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {Metric, MetricOverviewSection} from '../../../models/Metric';

export const dispatchSetMetricOverviewSlot = () => {
  const dispatch = useDispatch();

  return (section: MetricOverviewSection, slotIndex: number, metric: Metric) =>
    dispatch({
      type: 'SET_METRIC_OVERVIEW_SLOT',
      section,
      slotIndex,
      metric,
    } as Action & {section: MetricOverviewSection; slotIndex: number; metric: Metric});
};
