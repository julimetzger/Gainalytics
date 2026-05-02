import React, {useMemo, useState} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Card, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import {BarChart} from 'react-native-charts-wrapper';
import {useSelector} from 'react-redux';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Metric} from '../../../models/Metric';
import {GlobalState} from '../../../redux/rootReducer';
import {getAllTrainingsForMicro, getLocalMicro, getMesoForMicro} from '../../../redux/Training/trainingsPlanReducer';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';

type MetricKey = 'volume' | 'sets' | 'time';

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

      result.push({
        localMicro: m - mesoStart + 1,
        volume: Math.round(calculateMetricValue(sets, Metric.VOLUME)),
        sets: calculateMetricValue(sets, Metric.SETS),
        timeMinutes: Math.round(timeMs / 60000),
        trainingsCompleted: trainings.filter(t => t.end).length,
        trainingsTotal: trainingIds.length,
        avgRir: sets.length > 0 ? sets.reduce((s, ws) => s + (ws.rir ?? 0), 0) / sets.length : null,
      });
    }

    return result;
  });

interface MicroHeroCardProps {
  plan: TrainingsPlan;
  currentMicro: number;
}

const MicroHeroCard = ({plan, currentMicro}: MicroHeroCardProps) => {
  const theme = useTheme();
  const [metric, setMetric] = useState<MetricKey>('volume');

  const mesoData = useMesoBarData(plan, currentMicro);
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

  const formatValue = (val: number): string => {
    if (metric === 'volume') return `${val.toLocaleString()} kg`;
    if (metric === 'sets') return `${val}`;
    const h = Math.floor(val / 60);
    const m = val % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const barValues = useMemo(
    () => mesoData.map(d => ({y: getValue(d), marker: `M${d.localMicro}`})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesoData, metric],
  );

  const barColors = useMemo(
    () => mesoData.map((_, i) => processColor(i === mesoData.length - 1 ? theme.colors.primary : theme.colors.primaryContainer)),
    [mesoData, theme.colors.primary, theme.colors.primaryContainer],
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
            drawValues: false,
          },
          values: barValues,
        },
      ],
      config: {barWidth: 0.7},
    }),
    [barValues, barColors, theme.colors.onSurface],
  );

  const xAxisConfig = useMemo(
    () => ({
      valueFormatter: mesoData.map(d => `M${d.localMicro}`),
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
            <Text variant="titleMedium" numberOfLines={1}>
              {plan.name}
            </Text>
            <Text variant="bodySmall" style={{color: theme.colors.primary}}>
              {mesoLabel}M{localMicro}
            </Text>
          </View>
          <Text variant="titleLarge" style={{color: theme.colors.primary}} testID="micro-hero-completion">
            {trainingsCompleted}/{trainingsTotal}
          </Text>
        </View>

        <SegmentedButtons
          value={metric}
          onValueChange={v => setMetric(v as MetricKey)}
          buttons={[
            {value: 'volume', label: 'Volume'},
            {value: 'sets', label: 'Sets'},
            {value: 'time', label: 'Time'},
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
          <BarChart
            style={styles.chart}
            data={chartData}
            xAxis={xAxisConfig}
            yAxis={{
              left: {drawGridLines: false, textColor: processColor(theme.colors.onSurface), enabled: false},
              right: {enabled: false},
            }}
            chartDescription={{text: ''}}
            legend={{enabled: false}}
            drawValueAboveBar={false}
            animation={{durationX: 300}}
          />
        )}

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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {flex: 1, marginRight: 8},
  segmented: {marginVertical: 8},
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
