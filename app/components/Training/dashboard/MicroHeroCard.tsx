import React, {useMemo, useState} from 'react';
import {Dimensions, processColor, StyleSheet, View} from 'react-native';
import {Card, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import {BarChart} from 'react-native-charts-wrapper';
import {useSelector} from 'react-redux';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Metric} from '../../../models/Metric';
import {GlobalState} from '../../../redux/rootReducer';
import {
  getAllTrainingsForMicro,
  getLocalMicro,
  getMesoForMicro,
  getMicroFromTrainingInMicroIndex,
  getTrainingFromTrainingInMicroIndex,
} from '../../../redux/Training/trainingsPlanReducer';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {withAlpha} from '../../../utils/colorUtils';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import CompletionRing from './CompletionRing';
import DayStrip, {DayStatus, DayStripDay} from './DayStrip';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../../routing/TrainingRouter';
import {trainingsPlanDisplayName} from '../../../utils/trainings-plan-name';
import {BAR_VALUE_TEXT_SIZE, barAxisMaximum, barValueLabels, formatBarValue, MetricKey} from './microBarLabels';

interface MicroBarDatum {
  localMicro: number;
  volume: number;
  sets: number;
  timeMinutes: number;
  trainingsCompleted: number;
  trainingsTotal: number;
  avgRir: number | null;
}

const useMesoBarData = (plan: TrainingsPlan, currentMicro: number): MicroBarDatum[] =>
  useSelector((state: GlobalState) => {
    const currentMeso = getMesoForMicro(plan.mesos, currentMicro);
    const mesoStart = currentMeso?.startMicro ?? 1;
    const result: MicroBarDatum[] = [];

    for (let m = mesoStart; m <= currentMicro; m++) {
      const trainingIds = getAllTrainingsForMicro(plan.trainings, m);
      const trainings = trainingIds
        .map(id => state.trainings.byId[id])
        .filter((t): t is NonNullable<typeof t> => t != null);

      const workoutIds = trainings.flatMap(t => Object.values(t.doneWorkoutIds));
      const workouts = workoutIds
        .map(id => state.workouts.byId[id])
        .filter((w): w is NonNullable<typeof w> => w != null);

      const sets: WorkoutSet[] = workouts.flatMap(w => w.sets ?? []);
      const timeMs = trainings.reduce((sum, t) => {
        if (t.end && t.start) return sum + new Date(t.end).getTime() - new Date(t.start).getTime();
        return sum;
      }, 0);

      const trainingTypeCount = Object.keys(plan.trainingNames ?? {}).length;
      result.push({
        localMicro: m - mesoStart + 1,
        volume: Math.round(calculateMetricValue(sets, Metric.VOLUME)),
        sets: calculateMetricValue(sets, Metric.SETS),
        timeMinutes: Math.round(timeMs / 60000),
        trainingsCompleted: trainings.filter(t => t.end).length,
        trainingsTotal: trainingTypeCount > 0 ? trainingTypeCount : trainingIds.length,
        avgRir: sets.length > 0 ? sets.reduce((s, ws) => s + (ws.rir ?? 0), 0) / sets.length : null,
      });
    }

    return result;
  });

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const startOfDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const startOfWeek = (d: Date): Date => {
  const c = startOfDay(d);
  const dow = c.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  c.setDate(c.getDate() - diff);
  return c;
};

const toLocalIso = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const useThisWeekDays = (plan: TrainingsPlan): DayStripDay[] =>
  useSelector((state: GlobalState) => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today);

    // Map isoDate -> trainingId for trainings that ended this week
    const trainingEndMap = new Map<string, number>();
    for (const tId of Object.values(plan.trainings)) {
      const t = state.trainings.byId[tId];
      if (!t?.end) continue;
      const endDay = startOfDay(new Date(t.end));
      if (endDay.getTime() < weekStart.getTime()) continue;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (endDay.getTime() >= weekEnd.getTime()) continue;
      trainingEndMap.set(toLocalIso(endDay), tId);
    }

    return Array.from({length: 7}, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const iso = toLocalIso(day);
      const trainingId = trainingEndMap.get(iso);
      let status: DayStatus;
      if (trainingId !== undefined) {
        status = 'done';
      } else if (day.getTime() === today.getTime()) {
        status = 'today';
      } else if (day.getTime() < today.getTime()) {
        status = 'past';
      } else {
        status = 'future';
      }
      return {
        weekday: WEEKDAY_LETTERS[i],
        dayOfMonth: day.getDate(),
        status,
        isoDate: iso,
        trainingId,
      };
    });
  });

interface MicroHeroCardProps {
  plan: TrainingsPlan;
  currentMicro: number;
  navigation: NativeStackNavigationProp<RootStackParamList, 'TrainingHome'>;
}

const MicroHeroCard = ({plan, currentMicro, navigation}: MicroHeroCardProps) => {
  const theme = useTheme();
  const [metric, setMetric] = useState<MetricKey>('volume');
  // Card margin (8) + Card.Content padding (16) on each side until the chart reports its width.
  const [chartWidth, setChartWidth] = useState(() => Dimensions.get('window').width - 48);

  const mesoData = useMesoBarData(plan, currentMicro);
  const dayStripDays = useThisWeekDays(plan);

  const currentData = mesoData[mesoData.length - 1];
  const prevData = mesoData.length > 1 ? mesoData[mesoData.length - 2] : undefined;

  const localMicro = getLocalMicro(plan.mesos, currentMicro);
  const currentMeso = getMesoForMicro(plan.mesos, currentMicro);
  const mesoLabel = currentMeso ? `${currentMeso.name} · ` : '';

  const getValue = (d: MicroBarDatum | undefined): number => {
    if (!d) return 0;
    if (metric === 'volume') return d.volume;
    if (metric === 'sets') return d.sets;
    return d.timeMinutes;
  };

  const currentValue = getValue(currentData);
  const prevValue = getValue(prevData);
  const deltaAbs = prevValue > 0 ? currentValue - prevValue : null;
  const deltaPct = prevValue > 0 ? Math.round(((currentValue - prevValue) / prevValue) * 100) : null;
  const isPositive = (deltaAbs ?? 0) >= 0;

  const formatValue = (val: number): string => (metric === 'volume' ? `${formatBarValue(metric, val)} kg` : formatBarValue(metric, val));

  const barValues = useMemo(
    () => mesoData.map(d => ({y: getValue(d), marker: `M${d.localMicro}`})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesoData, metric],
  );

  // Array form -> native IndexValueFormatter, which (unlike 'labelByXValue')
  // implements getBarLabel and therefore works for bar value labels.
  const barLabels = useMemo(
    () =>
      barValueLabels(
        metric,
        barValues.map(v => v.y),
        chartWidth,
      ),
    [barValues, metric, chartWidth],
  );

  // GH-482: lists every bar as "<micro> <value>" so Maestro/TalkBack can read what
  // the native chart canvas draws.
  const chartAccessibilityLabel = barValues.map(v => `${v.marker} ${formatBarValue(metric, v.y)}`).join(', ');

  // GH-404: the history bars used `primaryContainer`, which is a near-white
  // fill in the light schemes — the whole chart was invisible on the card. A
  // dimmed `primary` keeps the palette's hue and the "latest micro stands out"
  // hierarchy while staying legible against `surface` in both schemes.
  const barColors = useMemo(
    () => mesoData.map((_, i) => processColor(i === mesoData.length - 1 ? theme.colors.primary : withAlpha(theme.colors.primary, 0.7))),
    [mesoData, theme.colors.primary],
  );

  const chartData = useMemo(
    () => ({
      dataSets: [
        {
          label: 'Micro',
          config: {
            visible: true,
            highlightEnabled: false,
            colors: barColors,
            valueTextColor: processColor(theme.colors.onSurface),
            valueTextSize: BAR_VALUE_TEXT_SIZE,
            drawValues: true,
            valueFormatter: barLabels,
          },
          values: barValues,
        },
      ],
      config: {barWidth: 0.7},
    }),
    [barValues, barLabels, barColors, theme.colors.onSurface],
  );

  const xAxisConfig = useMemo(
    () => ({
      valueFormatter: mesoData.map(d => `M${d.localMicro}`),
      // GH-482: MPAndroidChart puts the x axis on TOP by default, where the micro
      // labels collided with the value labels above the bars. Below the bars they
      // read as the bars' axis labels and the top stays free for the values.
      position: 'BOTTOM' as const,
      drawGridLines: false,
      granularityEnabled: true,
      granularity: 1,
      textColor: processColor(theme.colors.onSurface),
    }),
    [mesoData, theme.colors.onSurface],
  );

  const prevSets = prevData?.sets ?? 0;
  const prevTime = prevData?.timeMinutes ?? 0;
  const curSets = currentData?.sets ?? 0;
  const curTime = currentData?.timeMinutes ?? 0;
  const avgRir = currentData?.avgRir;
  const trainingsCompleted = currentData?.trainingsCompleted ?? 0;
  const trainingsTotal = currentData?.trainingsTotal ?? 0;

  return (
    <Card style={styles.card} testID="micro-hero-card">
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
              Current micro
            </Text>
            <Text variant="titleMedium" numberOfLines={1} testID="micro-hero-plan-name">
              {trainingsPlanDisplayName(plan.name)}
            </Text>
            <Text variant="bodySmall" style={{color: theme.colors.primary}}>
              {mesoLabel}M{localMicro}
            </Text>
          </View>
          <CompletionRing completed={trainingsCompleted} total={trainingsTotal} testID="micro-hero-completion" />
        </View>

        <SegmentedButtons
          value={metric}
          onValueChange={v => setMetric(v as MetricKey)}
          density="small"
          buttons={[
            {value: 'volume', label: 'Volume', style: styles.segmentBtn, labelStyle: styles.segmentBtnLabel},
            {value: 'sets', label: 'Sets', style: styles.segmentBtn, labelStyle: styles.segmentBtnLabel},
            {value: 'time', label: 'Time', style: styles.segmentBtn, labelStyle: styles.segmentBtnLabel},
          ]}
          style={styles.segmented}
        />

        <View style={styles.valueRow}>
          <Text variant="displaySmall" style={{color: theme.colors.primary}} testID="micro-hero-value">
            {formatValue(currentValue)}
          </Text>
          {deltaPct !== null && (
            <View style={styles.deltaBlock}>
              <Text style={[styles.deltaText, {color: isPositive ? theme.colors.primary : theme.colors.error}]}>
                {isPositive ? '+' : ''}
                {deltaPct}%
              </Text>
              <Text style={[styles.deltaSubText, {color: isPositive ? theme.colors.primary : theme.colors.error}]}>
                {isPositive ? '+' : ''}
                {deltaAbs} vs M{localMicro - 1}
              </Text>
            </View>
          )}
        </View>

        {mesoData.length > 0 && (
          <View testID="micro-hero-chart" accessible accessibilityLabel={chartAccessibilityLabel} onLayout={e => setChartWidth(e.nativeEvent.layout.width)}>
            <BarChart
              style={styles.chart}
              data={chartData}
              xAxis={xAxisConfig}
              yAxis={{
                left: {
                  drawGridLines: false,
                  textColor: processColor(theme.colors.onSurface),
                  enabled: false,
                  axisMinimum: 0,
                  axisMaximum: barAxisMaximum(barValues.map(v => v.y)),
                },
                right: {enabled: false},
              }}
              chartDescription={{text: ''}}
              legend={{enabled: false}}
              drawValueAboveBar={true}
              animation={{durationX: 300}}
            />
          </View>
        )}

        <DayStrip
          days={dayStripDays}
          onDayPress={trainingId => {
            const entry = Object.entries(plan.trainings).find(([, v]) => v === trainingId);
            if (!entry) return;
            const micro = getMicroFromTrainingInMicroIndex(entry[0]);
            const training = getTrainingFromTrainingInMicroIndex(entry[0]);
            navigation.navigate({name: 'TrainingPlan', params: {trainingsPlan: plan, micro, training}});
          }}
        />

        <View style={styles.kpiRow}>
          {avgRir !== null && (
            <View style={styles.kpiItem}>
              <Text variant="labelSmall" style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>
                RIR
              </Text>
              <Text variant="titleSmall">{avgRir.toFixed(1)}</Text>
            </View>
          )}
          <View style={styles.kpiItem}>
            <Text variant="labelSmall" style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>
              Sets
            </Text>
            <Text variant="titleSmall">{curSets}</Text>
            {prevSets > 0 && (
              <Text style={[styles.kpiDelta, {color: curSets >= prevSets ? theme.colors.primary : theme.colors.error}]}>
                {curSets >= prevSets ? '+' : ''}
                {curSets - prevSets}
              </Text>
            )}
          </View>
          <View style={styles.kpiItem}>
            <Text variant="labelSmall" style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>
              Time
            </Text>
            <Text variant="titleSmall">
              {Math.floor(curTime / 60)}h {curTime % 60}m
            </Text>
            {prevTime > 0 && (
              <Text style={[styles.kpiDelta, {color: curTime >= prevTime ? theme.colors.primary : theme.colors.error}]}>
                {curTime >= prevTime ? '+' : ''}
                {curTime - prevTime}m
              </Text>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {margin: 8},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  headerLeft: {flex: 1, marginRight: 8},
  segmented: {marginVertical: 8, alignSelf: 'flex-start'},
  segmentBtn: {borderWidth: 0, minWidth: 64, paddingHorizontal: 4},
  segmentBtnLabel: {fontSize: 12, fontWeight: '500'},
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 12,
  },
  deltaBlock: {alignItems: 'flex-start', paddingBottom: 8},
  deltaText: {fontSize: 16, fontWeight: '600'},
  deltaSubText: {fontSize: 12},
  chart: {height: 160},
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  kpiItem: {alignItems: 'center'},
  kpiLabel: {marginBottom: 2},
  kpiDelta: {fontSize: 11, marginTop: 1},
});

export default MicroHeroCard;
