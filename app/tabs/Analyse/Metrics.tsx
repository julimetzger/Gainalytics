import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import React, {useState} from 'react';
import AnalyseFilterPanel from '../../components/picker/filter/AnalyseFilterPanel';
import {Range} from '../../components/picker/date/DateRangePicker';
import {Exercise} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';
import RangeSwiper from '../../components/RangeSwiper';
import {firstDayOfWeek, lastDayOfWeek} from '../../utils/DateHelper';
import MetricsNode from '../../components/analyse/MetricsNode';

interface MetricsTabContentProps {
  initialMuscle?: Muscles;
  initialRange: Range;
}

const MetricsTabContent = ({initialMuscle, initialRange}: MetricsTabContentProps) => {
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>(initialMuscle ? [initialMuscle] : []);

  return (
    <RangeSwiper
      notSwipeableContent={<AnalyseFilterPanel exercise={exercise} setExercise={setExercise} muscle={muscle} setMuscle={setMuscle} />}
      nodeFunction={(range: Range, setRange: (range: Range) => void) => <MetricsNode range={range} setRange={setRange} exercise={exercise} muscle={muscle} />}
      determineValueByIndex={(index: number, range: Range) => {
        if (index === 0) {
          return range;
        }
        if (index === 1) {
          return range.plusOneRange();
        }
        if (index === -1) {
          return range.minusRange();
        }
        return range;
      }}
      startValue={initialRange}
    />
  );
};

export const buildMetricsDrilldownKey = (params: RootStackParamList['Metrics']) => `${params?.muscle ?? 'all'}-${params?.rangeStartMs ?? 'default'}-${params?.rangeEndMs ?? 'default'}-${params?.drilldownNonce ?? 0}`;

const MetricsTab = ({route}: Props) => {
  const params = route?.params;
  const now = new Date();
  const currentWeekRange = new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0));
  const drilldownRange = params?.rangeStartMs !== undefined && params?.rangeEndMs !== undefined ? new Range(new Date(params.rangeStartMs), new Date(params.rangeEndMs)) : undefined;

  // GH-458 (H4): "Tap a muscle group for details" used to land here with
  // `0 selected` and the range reset to the current week — the promised detail
  // view was an empty, unfiltered table. The muscle and a range that holds data
  // now arrive as params.
  //
  // The drawer keeps this screen mounted, and both the muscle selection and the
  // RangeSwiper's start value are seeded into state on mount only. Remounting
  // the content on a new drill-down is what makes a SECOND tap take effect too.
  return <MetricsTabContent key={buildMetricsDrilldownKey(params)} initialMuscle={params?.muscle} initialRange={drilldownRange ?? currentWeekRange} />;
};

export default MetricsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Metrics'>;
