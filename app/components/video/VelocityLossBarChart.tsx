import React, {useMemo, useState} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {BarChart} from 'react-native-charts-wrapper';
import {RepMetric, VideoAnalysisSetResult} from '../../models/entities/VideoAnalysis';

interface Props {
  repMetrics?: RepMetric[];
  savedSetResult?: VideoAnalysisSetResult;
  metersPerPixel?: number;
}

type PlotMode = 'vl' | 'vAvg' | 'drift';

const CHART_HEIGHT = 180;
const VL_WARN_THRESHOLD = 30;

const VelocityLossBarChart = ({repMetrics = [], savedSetResult, metersPerPixel}: Props) => {
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

  const vAvgChartData = useMemo(() => {
    let rawValues: number[];
    if (repResults && repResults.length > 0) {
      rawValues = repResults.map(r => r.vAvg);
    } else if (repMetrics.length > 0) {
      rawValues = repMetrics.map(m => m.averageConcentricSpeedPxPerS);
    } else {
      return [];
    }
    const converted = metersPerPixel ? rawValues.map(v => v * metersPerPixel) : rawValues;
    return converted.map((v, i) => ({x: i, y: Math.round(v * 100) / 100}));
  }, [repMetrics, repResults, metersPerPixel]);

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
  const chartData = mode === 'vl' ? vlChartData : mode === 'vAvg' ? vAvgChartData : driftChartData;

  const xLabels = useMemo(
    () => Array.from({length: chartData.length}, (_, i) => `R${i + 1}`),
    [chartData.length],
  );

  const barColors = useMemo(() => {
    if (mode === 'vl') {
      return chartData.map(d =>
        processColor(d.y < VL_WARN_THRESHOLD ? theme.colors.primary : theme.colors.error),
      );
    }
    if (mode === 'vAvg') {
      return chartData.map(() => processColor(theme.colors.primary));
    }
    return chartData.map(() => processColor(theme.colors.tertiary));
  }, [chartData, mode, theme.colors.error, theme.colors.primary, theme.colors.tertiary]);

  const valueFormatter = useMemo(() => {
    if (mode === 'vl') {
      return chartData.map(d => `${d.y}%`);
    }
    return undefined;
  }, [chartData, mode]);

  const vAvgMax = useMemo(() => {
    if (vAvgChartData.length === 0) {
      return 1;
    }
    return Math.max(...vAvgChartData.map(d => d.y));
  }, [vAvgChartData]);

  const axisMax = useMemo(() => {
    if (mode === 'vAvg') {
      return vAvgMax * 1.15;
    }
    if (chartData.length === 0) {
      return 10;
    }
    return Math.max(10, Math.ceil(Math.max(...chartData.map(d => Math.abs(d.y))) * 1.3));
  }, [chartData, mode, vAvgMax]);

  const axisMin = mode === 'vl' ? -Math.ceil(axisMax * 0.4) : 0;

  if (vlChartData.length === 0) {
    return null;
  }

  const textColor = processColor(theme.colors.onSurface);
  const gridColor = processColor(theme.colors.outlineVariant);
  const vAvgSpeedUnit = metersPerPixel ? 'm/s' : 'px/s';

  const axisLabel =
    mode === 'vl'
      ? 'Velocity Loss % per Rep (concentric, rel. Rep 1)'
      : mode === 'vAvg'
      ? `Avg Concentric Speed (${vAvgSpeedUnit}) per Rep`
      : 'Bar Path Drift % per Rep';

  const limitLines =
    mode === 'vAvg'
      ? [
          {
            limit: vAvgMax,
            lineColor: processColor(theme.colors.secondary),
            lineWidth: 1.5,
            lineDashLengths: [6, 4],
            lineDashPhase: 0,
          },
        ]
      : [
          {
            limit: 0,
            lineColor: processColor(theme.colors.error),
            lineWidth: 1.5,
            lineDashLengths: [6, 4],
            lineDashPhase: 0,
          },
        ];

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
        <Button
          testID="vl-bar-chart-btn-vavg"
          mode={mode === 'vAvg' ? 'contained-tonal' : 'outlined'}
          compact
          onPress={() => setMode('vAvg')}
          style={styles.toggleBtn}
        >
          Velocity Avg
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
        {axisLabel}
      </Text>
      <BarChart
        testID="velocity-loss-bar-chart"
        style={styles.chart}
        data={{
          dataSets: [
            {
              values: chartData,
              label: mode === 'vl' ? 'VL Loss %' : mode === 'vAvg' ? `vAvg ${vAvgSpeedUnit}` : 'Drift %',
              config: {
                colors: barColors,
                drawValues: true,
                valueTextSize: 10,
                valueTextColor: textColor,
                ...(valueFormatter ? {valueFormatter} : {}),
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
            limitLines,
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
