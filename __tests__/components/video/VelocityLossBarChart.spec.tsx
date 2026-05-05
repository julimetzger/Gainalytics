import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import VelocityLossBarChart from '../../../app/components/video/VelocityLossBarChart';
import {VideoAnalysisSetResult} from '../../../app/models/entities/VideoAnalysis';
import {RepMetric} from '../../../app/models/entities/VideoAnalysis';

jest.mock('react-native-charts-wrapper', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    BarChart: (props: any) => <View testID={props.testID} />,
    LineChart: (props: any) => <View testID={props.testID} />,
    processColor: (color: string) => color,
  };
});

const renderWithPaper = (ui: React.ReactElement) =>
  render(<PaperProvider>{ui}</PaperProvider>);

const makeSetResult = (vAvgs: number[], pathDeviations?: (number | undefined)[]): VideoAnalysisSetResult => ({
  velocityLossPercent: null,
  rirEstimate: null,
  repResults: vAvgs.map((vAvg, i) => ({
    repIndex: i,
    startMs: 0,
    turnaroundMs: 500,
    endMs: 1000,
    totalTimeMs: 1000,
    eccentricTimeMs: 500,
    concentricTimeMs: 500,
    vAvg,
    vPeak: vAvg * 1.2,
    path_deviation: pathDeviations?.[i],
  })),
});

const makeRepMetrics = (speeds: number[]): RepMetric[] =>
  speeds.map((s, i) => ({
    repIndex: i,
    repTimeMs: 1000,
    concentricTimeMs: 500,
    averageConcentricSpeedPxPerS: s,
    lowestConcentricSpeedPxPerS: s * 0.8,
  }));

describe('VelocityLossBarChart', () => {
  it('renders null when no data is available', () => {
    const {queryByTestId} = renderWithPaper(
      <VelocityLossBarChart repMetrics={[]} savedSetResult={undefined} />,
    );
    expect(queryByTestId('velocity-loss-bar-chart-container')).toBeNull();
  });

  it('renders container when repMetrics are provided', () => {
    const {getByTestId} = renderWithPaper(
      <VelocityLossBarChart repMetrics={makeRepMetrics([300, 270, 240])} />,
    );
    expect(getByTestId('velocity-loss-bar-chart-container')).toBeTruthy();
  });

  it('renders container when savedSetResult is provided', () => {
    const {getByTestId} = renderWithPaper(
      <VelocityLossBarChart savedSetResult={makeSetResult([400, 360, 300])} />,
    );
    expect(getByTestId('velocity-loss-bar-chart-container')).toBeTruthy();
  });

  it('shows VL Loss and Velocity Avg buttons by default', () => {
    const {getByTestId} = renderWithPaper(
      <VelocityLossBarChart savedSetResult={makeSetResult([400, 360, 300])} />,
    );
    expect(getByTestId('vl-bar-chart-btn-vl')).toBeTruthy();
    expect(getByTestId('vl-bar-chart-btn-vavg')).toBeTruthy();
  });

  it('does not show Drift button when no path_deviation data', () => {
    const {queryByTestId} = renderWithPaper(
      <VelocityLossBarChart savedSetResult={makeSetResult([400, 360, 300])} />,
    );
    expect(queryByTestId('vl-bar-chart-btn-drift')).toBeNull();
  });

  it('shows Drift button when path_deviation data is present', () => {
    const {getByTestId} = renderWithPaper(
      <VelocityLossBarChart
        savedSetResult={makeSetResult([400, 360, 300], [0.01, 0.02, 0.03])}
      />,
    );
    expect(getByTestId('vl-bar-chart-btn-drift')).toBeTruthy();
  });

  it('switches to vAvg mode on button press', () => {
    const {getByTestId, getByText} = renderWithPaper(
      <VelocityLossBarChart savedSetResult={makeSetResult([400, 360, 300])} />,
    );
    fireEvent.press(getByTestId('vl-bar-chart-btn-vavg'));
    expect(getByText('Avg Concentric Speed (px/s) per Rep')).toBeTruthy();
  });

  it('shows m/s unit when metersPerPixel is provided in vAvg mode', () => {
    const {getByTestId, getByText} = renderWithPaper(
      <VelocityLossBarChart
        savedSetResult={makeSetResult([400, 360, 300])}
        metersPerPixel={0.002}
      />,
    );
    fireEvent.press(getByTestId('vl-bar-chart-btn-vavg'));
    expect(getByText('Avg Concentric Speed (m/s) per Rep')).toBeTruthy();
  });

  it('shows VL Loss axis label by default', () => {
    const {getByText} = renderWithPaper(
      <VelocityLossBarChart savedSetResult={makeSetResult([400, 360, 300])} />,
    );
    expect(getByText('Velocity Loss % per Rep (concentric, rel. Rep 1)')).toBeTruthy();
  });

  it('computes vAvg data from repMetrics when no setResult', () => {
    // Component should render without crash using repMetrics for vAvg
    const {getByTestId} = renderWithPaper(
      <VelocityLossBarChart repMetrics={makeRepMetrics([300, 270, 240])} />,
    );
    fireEvent.press(getByTestId('vl-bar-chart-btn-vavg'));
    expect(getByTestId('velocity-loss-bar-chart-container')).toBeTruthy();
  });
});
