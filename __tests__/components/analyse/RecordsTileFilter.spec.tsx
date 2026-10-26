/// <reference types="@testing-library/jest-native" />
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import RecordsHeatmap from '../../../app/components/analyse/records/RecordsHeatmap';
import RecordsMuscleLanes from '../../../app/components/analyse/records/RecordsMuscleLanes';
import RecordCardList from '../../../app/components/analyse/records/RecordCardList';
import {buildHeatmapModel, buildMuscleLaneModel} from '../../../app/utils/RecordsAnalysis';
import {Accumulation} from '../../../app/components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../../../app/models/AccumulationMode';
import {Exercise, Record} from '../../../app/models/entities/Exercise';
import {Muscles} from '../../../app/models/Muscles';
import {Workout} from '../../../app/models/entities/Workout';

// GH-617: tapping a heatmap tile / muscle bar filters the record list.

const recordWorkout = (id: number, exerciseId: number, start: Date, oneRm: number): Workout => ({
  id,
  exerciseId,
  start,
  sets: [{reps: 5, rir: 1, weight: 100}],
  records: {[Record.ONE_RM]: oneRm},
});

const squat: Exercise = {id: 1, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}]};
const bench: Exercise = {id: 2, name: 'Bench', muscles: [{muscle: Muscles.CHEST, percent: 100}]};

const workouts = [
  recordWorkout(1, 1, new Date(2026, 2, 24), 180),
  recordWorkout(2, 2, new Date(2026, 2, 26), 120),
  recordWorkout(3, 1, new Date(2026, 3, 8), 185),
];
const rangeStart = new Date(2026, 2, 23);
const rangeEnd = new Date(2026, 3, 19, 23, 59, 59);
const week = new Accumulation(AccumulationMode.WEEK);

const wrap = (node: React.ReactElement) => render(<PaperProvider>{node}</PaperProvider>);

describe('RecordsHeatmap tile selection', () => {
  const model = buildHeatmapModel(workouts, rangeStart, rangeEnd, week);

  it('hands the tapped tile with its records to onSelect', () => {
    const onSelect = jest.fn();
    wrap(<RecordsHeatmap model={model} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('records-tile-week-2026-03-23'));
    expect(onSelect).toHaveBeenCalledWith({key: 'week-2026-03-23', title: 'week of 03/23/26', count: 2, workouts: [workouts[0], workouts[1]]});
  });

  it('labels tiles with title and count and marks the selected tile', () => {
    wrap(<RecordsHeatmap model={model} selectedKey="week-2026-04-06" onSelect={jest.fn()} />);
    const selected = screen.getByTestId('records-tile-week-2026-04-06');
    expect(selected.props.accessibilityLabel).toBe('week of 04/06/26: 1 record');
    expect(selected.props.accessibilityState).toEqual({selected: true, disabled: false});
    expect(screen.getByTestId('records-tile-week-2026-03-23').props.accessibilityState).toEqual({selected: false, disabled: false});
  });

  it('ignores taps on empty tiles', () => {
    const onSelect = jest.fn();
    wrap(<RecordsHeatmap model={model} onSelect={onSelect} />);
    const empty = screen.getByTestId('records-tile-week-2026-03-30');
    expect(empty.props.accessibilityState).toEqual({selected: false, disabled: true});
    fireEvent.press(empty);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('RecordsMuscleLanes bar selection', () => {
  it('hands the records of the tapped bar to onSelect; empty buckets have no bar', () => {
    const model = buildMuscleLaneModel(workouts, [squat, bench], rangeStart, rangeEnd, week);
    const onSelect = jest.fn();
    wrap(<RecordsMuscleLanes model={model} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('records-bar-Legs-2'));
    expect(onSelect).toHaveBeenCalledWith({key: 'lane-Legs-2', title: 'Legs · week of 04/06/26', workouts: [workouts[2]]});
    expect(screen.queryByTestId('records-bar-Legs-1')).toBeNull();
  });
});

describe('RecordCardList filter header', () => {
  it('shows "N shown" without a tile filter', () => {
    wrap(<RecordCardList recordWorkouts={workouts} exercises={[squat, bench]} />);
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');
    expect(screen.queryByTestId('records-show-all')).toBeNull();
  });

  it('names the tile filter with its count and clears it via "Show all"', () => {
    const onShowAll = jest.fn();
    wrap(<RecordCardList recordWorkouts={[workouts[0], workouts[1]]} exercises={[squat, bench]} filterTitle="week of 03/23/26" onShowAll={onShowAll} />);
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('2 records · week of 03/23/26');
    expect(screen.getByTestId('record-card-1')).toBeTruthy();
    expect(screen.queryByTestId('record-card-2')).toBeNull();
    fireEvent.press(screen.getByTestId('records-show-all'));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
