import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {MetricOverviewSection, resolveMetricOverviewSlots} from '../../../models/Metric';
import {GlobalState} from '../../rootReducer';

export const useMetricOverviewSlots = (section: MetricOverviewSection) => {
  const storedSlots = useSelector((state: GlobalState) => state.settings.metricOverview?.[section]);

  return useMemo(() => resolveMetricOverviewSlots(storedSlots, section), [section, storedSlots]);
};
