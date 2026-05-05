import React, {useMemo, useState} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {BarChart} from 'react-native-charts-wrapper';
import {RepMetric, VideoAnalysisSetResult} from '../../models/entities/VideoAnalysis';

interface Props {
  repMetrics?: RepMetric[];
  savedSetResult?: VideoAnalysisSetResult;
}

type PlotMode = 'vl' | 'drift';

const CHART_HEIGHT = 180;

const VelocityLossBarChart = ({repMetrics = [], savedSetResult}: Props) => {
  const theme = useTheme();
  const [mode, setMode] = useState<PlotMode>('vl');

  const repResults = savedSetResult?.repResults;

  const vlChartData = useMemo(() => {
    const source = repResults ?? repMetrics.map(m => ({vAvg: Math.round(m.averageConcentricSpeedPxPerS)}));
    if (source.length === 0) {
      return [];
    }
    const firstVAvg = source[0].vAvg;
    if (firstVAvg <= 0) {
      return [];
    }
    return source.map((r, i) => ({
      x: i,
      y: i === 0 ? 0 : Math.round((1 - r.vAvg / firstVAvg) * 100),
    }));
  }, [repMetrics, repResults]);

  const driftChartData = useMemo(() => {
    if (!repResults) {
      return [];
    }
    return repResults
      .map((r, i) => ({
        x: i,
        y: r.path_deviation != null ? Math.round(r.path_deviation * 1000) / 10 : 0,
      }))
      .filter((_, i) => repResults[i].path_deviation != null);
  }, [repResults]);

  const hasDrift = driftChartData.length > 0;
  const chartData = mode === 'vl' ? vlChartData : driftChartData;

  const xLabels = useMemo(
    () => Array.from({length: chartData.length}, (_, i) => `R${i + 1}`),
    [chartData.length],
  );

  const barColors = useMemo(() => {
    if (mode === 'vl') {
      return chartData.map(d =>
        processColor(d.y <= 0 ? theme.colors.primary : theme.colors.error),
      );
    }
    return chartData.map(() => processColor(theme.colors.tertiary));
  }, [chartData, mode, theme.colors.error, theme.colors.primary, theme.colors.tertiary]);

  const axisMax = useMemo(() => {
    if (chartData.length === 0) {
      return 10;
    }
    return Math.max(10, Math.ceil(Math.max(...chartData.map(d => Math.abs(d.y))) * 1.3));
  }, [chartData]);

  const axisMin = mode === 'vl' ? -Math.ceil(axisMax * 0.4) : 0;

  if (vlChartData.length === 0) {
    return null;
  }

  const textColor = processColor(theme.colors.onSurface);
  const gridColor = processColor(theme.colors.outlineVariant);
  const zeroLineColor = processColor(theme.colors.error);

  return (
    <View testID="velocity-loss-bar-chart-container">
      <View style={styles.toggleRow}>
        <Button
          testID="vl-bar-chart-btn-vl"
          mode={mode === 'vl' ? 'contained-tonal' : 'outlined'}
          compact
          onPress={() => setMode('vl')}
          style={styles.toggleBtn}
        >
          VL Loss
        </Button>
        {hasDrift && (
          <Button
            testID="vl-bar-chart-btn-drift"
            mode={mode === 'drift' ? 'contained-tonal' : 'outlined'}
            compact
            onPress={() => setMode('drift')}
            style={styles.toggleBtn}
          >
            Drift
          </Button>
        )}
      </View>
      <Text variant="labelSmall" style={styles.axisLabel}>
        {mode === 'vl' ? 'Velocity Loss % per Rep (concentric, rel. Rep 1)' : 'Bar Path Drift % per Rep'}
      </Text>
      <BarChart
        testID="velocity-loss-bar-chart"
        style={styles.chart}
        data={{
          dataSets: [
            {
              values: chartData,
              label: mode === 'vl' ? 'VL Loss %' : 'Drift %',
              config: {
                colors: barColors,
                drawValues: true,
                valueTextSize: 10,
                valueTextColor: textColor,
              },
            },
          ],
          config: {
            barWidth: 0.6,
          },
        }}
        xAxis={{
          enabled: true,
          position: 'BOTTOM',
          drawGridLines: false,
          valueFormatter: xLabels,
          textColor: textColor,
          axisMinimum: -0.5,
          axisMaximum: chartData.length - 0.5,
          granularity: 1,
          granularityEnabled: true,
          labelCount: chartData.length,
          labelCountForce: true,
        }}
        yAxis={{
          left: {
            axisMinimum: axisMin,
            axisMaximum: axisMax,
            textColor: textColor,
            gridColor: gridColor,
            limitLines: [
              {
                limit: 0,
                lineColor: zeroLineColor,
                lineWidth: 1.5,
                lineDashLengths: [6, 4],
                lineDashPhase: 0,
              },
            ],
            drawLimitLinesBehindData: true,
          },
          right: {enabled: false},
        }}
        legend={{enabled: false}}
        chartDescription={{text: ''}}
        drawValueAboveBar
        touchEnabled={false}
        marker={{enabled: false}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    minWidth: 80,
  },
  axisLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  chart: {
    height: CHART_HEIGHT,
  },
});

export default VelocityLossBarChart;
