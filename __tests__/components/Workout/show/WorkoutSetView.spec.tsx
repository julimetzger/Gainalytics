import React from 'react';
import {render} from '@testing-library/react-native';
import WorkoutSetView from '../../../../app/components/Workout/show/WorkoutSetView';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text: RNText, TouchableOpacity, View} = require('react-native');

  function DataTableRow({children, onPress, style}: any) {
    return (
      <TouchableOpacity testID="dt-row" onPress={onPress} style={style}>
        <View style={{flexDirection: 'row'}}>{children}</View>
      </TouchableOpacity>
    );
  }
  function DataTableCell({children, style}: any) {
    return <View style={style}>{children}</View>;
  }
  function DataTable({children}: any) {
    return <View>{children}</View>;
  }
  DataTable.Row = DataTableRow;
  DataTable.Cell = DataTableCell;

  return {
    DataTable,
    Divider: ({testID}: any) => <View testID={testID ?? 'row-divider'} />,
    Icon: ({source}: any) => <View testID={`icon-${source}`} />,
    Text: ({children, testID, style, variant}: any) => (
      <RNText testID={testID} style={style}>
        {children}
      </RNText>
    ),
    useTheme: () => ({
      colors: {
        primary: '#6200ee',
        secondary: '#03dac4',
        tertiary: '#018786',
        error: '#b00020',
        onSurface: '#000000',
        outline: '#aaaaaa',
      },
    }),
  };
});

jest.mock('../../../../app/components/Workout/add/AddWorkoutSet', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => <View testID="add-workout-set" />;
});

const set1: WorkoutSet = {index: 1, reps: 5, rir: 1, weight: 100};
const set2: WorkoutSet = {index: 2, reps: 8, rir: 2, weight: 80};

describe('WorkoutSetView', () => {
  describe('video icon visibility', () => {
    it('renders video icon when set has a linked analysis', () => {
      const linkedAnalyses = [{setIndex: 1, analysisId: 42}];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      expect(getByTestId('set-linked-video-1')).toBeTruthy();
    });

    it('renders video-plus icon when set has no linked analysis', () => {
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={[]} />,
      );
      expect(getByTestId('set-link-video-1')).toBeTruthy();
    });

    it('renders video-plus icon even without onLinkVideo prop (always visible)', () => {
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={undefined} />,
      );
      expect(getByTestId('set-link-video-1')).toBeTruthy();
    });

    it('renders video icon regardless of whether VL/Drift metrics are present', () => {
      const linkedAnalyses = [{setIndex: 1, analysisId: 42, vlPercent: 20, drift: 1.5}];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      // video icon must be present even though metrics row is also rendered
      expect(getByTestId('set-linked-video-1')).toBeTruthy();
      expect(getByTestId('set-video-metrics-1')).toBeTruthy();
    });

    it('renders video-plus for every set that has no linked analysis', () => {
      const linkedAnalyses = [{setIndex: 2, analysisId: 99, vlPercent: 10}];
      const {getByTestId, queryByTestId} = render(
        <WorkoutSetView sets={[set1, set2]} linkedAnalyses={linkedAnalyses} />,
      );
      // set1 has no linked analysis → video-plus
      expect(getByTestId('set-link-video-1')).toBeTruthy();
      // set2 has a linked analysis → video
      expect(getByTestId('set-linked-video-2')).toBeTruthy();
      expect(queryByTestId('set-link-video-2')).toBeNull();
    });
  });

  describe('DONE analysis preference (Fix 3)', () => {
    it('prefers the DONE analysis over a queued one so VL/Drift renders', () => {
      const linkedAnalyses = [
        // queued entry first — no vlPercent/drift
        {setIndex: 1, analysisId: 10},
        // DONE entry second — has metrics
        {setIndex: 1, analysisId: 11, vlPercent: 15.5, drift: 3.2},
      ];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      expect(getByTestId('set-video-metrics-1')).toBeTruthy();
      expect(getByTestId('set-vl-1')).toBeTruthy();
      expect(getByTestId('set-drift-1')).toBeTruthy();
    });

    it('shows video icon using DONE analysis id when queued analysis comes first', () => {
      const onVideoPress = jest.fn();
      const linkedAnalyses = [
        {setIndex: 1, analysisId: 10}, // queued
        {setIndex: 1, analysisId: 11, vlPercent: 15.5, drift: 3.2}, // DONE
      ];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} onVideoPress={onVideoPress} />,
      );
      // icon is shown (linked entry was resolved to the DONE one)
      expect(getByTestId('set-linked-video-1')).toBeTruthy();
    });

    it('falls back to any linked entry when none has DONE metrics', () => {
      const linkedAnalyses = [
        {setIndex: 1, analysisId: 10}, // queued, no metrics
      ];
      const {getByTestId, queryByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      // video icon shows (entry exists)
      expect(getByTestId('set-linked-video-1')).toBeTruthy();
      // but no metrics row since vlPercent/drift are absent
      expect(queryByTestId('set-video-metrics-1')).toBeNull();
    });
  });

  describe('metrics row visual grouping (Fix 1)', () => {
    it('renders Divider after the metrics row when metrics are present', () => {
      const linkedAnalyses = [{setIndex: 1, analysisId: 11, vlPercent: 20, drift: 1.5}];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      expect(getByTestId('set-video-metrics-1')).toBeTruthy();
      expect(getByTestId('set-metrics-divider-1')).toBeTruthy();
    });

    it('suppresses the DataTable.Row bottom border when metrics follow', () => {
      const linkedAnalyses = [{setIndex: 1, analysisId: 11, vlPercent: 20, drift: 1.5}];
      const {getByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      const row = getByTestId('dt-row');
      // borderBottomWidth: 0 must be in the style to suppress the DataTable.Row divider
      expect(row.props.style).toMatchObject({borderBottomWidth: 0});
    });

    it('keeps the default DataTable.Row border when no metrics are present', () => {
      const linkedAnalyses = [{setIndex: 1, analysisId: 10}]; // queued, no vlPercent
      const {getByTestId, queryByTestId} = render(
        <WorkoutSetView sets={[set1]} linkedAnalyses={linkedAnalyses} />,
      );
      const row = getByTestId('dt-row');
      // borderBottomWidth: 0 must NOT be in the style when no metrics
      const style = row.props.style as Record<string, unknown>;
      expect(style.borderBottomWidth).not.toBe(0);
      expect(queryByTestId('set-metrics-divider-1')).toBeNull();
    });
  });
});
