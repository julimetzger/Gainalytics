import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import CompareAnalysisPickerItem from '../../../app/components/video/CompareAnalysisPickerItem';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {useExercise} from '../../../app/redux/Exercises/use/useExercise';
import {useWorkoutById} from '../../../app/redux/Workout/use/useWorkoutById';

jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');

  return {
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({colors: {outlineVariant: '#343845'}}),
  };
});

const mockedUseExercise = jest.mocked(useExercise);
const mockedUseWorkoutById = jest.mocked(useWorkoutById);

const createAnalysis = (overrides?: Partial<VideoAnalysis>): VideoAnalysis => ({
  id: 3,
  exerciseId: 2,
  workoutId: 5565,
  setIndex: 2,
  sourceUri: 'file:///sdcard/Download/squat-3reps.mp4',
  createdAt: new Date('2026-02-02T19:48:03.009Z'),
  status: VideoAnalysisStatus.DONE,
  videoMeta: {durationMs: 5000, fps: 30, width: 1920, height: 1080},
  ...overrides,
});

const squatWorkout = {
  id: 5565,
  exerciseId: 2,
  sets: [
    {index: 1, weight: 175, reps: 5, rir: 2},
    {index: 2, weight: 155, reps: 9, rir: 2},
  ],
};

describe('CompareAnalysisPickerItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseExercise.mockReturnValue({id: 2, name: 'Squat'});
    mockedUseWorkoutById.mockReturnValue(squatWorkout as any);
  });

  it('identifies the analysis by exercise, set number, load and RIR instead of its id', () => {
    const {getByTestId, queryByText} = render(<CompareAnalysisPickerItem analysis={createAnalysis()} onPress={jest.fn()} />);

    expect(getByTestId('compare-picker-item-title-3').props.children).toEqual('Squat · Set 2 · 155 kg @ 2 RIR');
    expect(queryByText('Analysis #3')).toBeNull();
  });

  it('falls back to a meaningful title when the analysis has no linked set', () => {
    mockedUseWorkoutById.mockReturnValue(undefined);

    const {getByTestId} = render(
      <CompareAnalysisPickerItem analysis={createAnalysis({workoutId: undefined, setIndex: undefined})} onPress={jest.fn()} />,
    );

    expect(getByTestId('compare-picker-item-title-3').props.children).toEqual('Squat · No linked set');
  });

  it('keeps date, metrics and the selection callback intact', () => {
    const onPress = jest.fn();
    const analysis = createAnalysis({
      setResult: {
        repResults: [{repIndex: 1}, {repIndex: 2}] as any,
        velocityLossPercent: 32,
        rirEstimate: null,
      },
    });

    const {getByTestId, getByText} = render(<CompareAnalysisPickerItem analysis={analysis} onPress={onPress} />);

    expect(getByText('2 reps | VL 32%')).toBeTruthy();
    expect(getByText(new Date(analysis.createdAt).toLocaleString())).toBeTruthy();

    fireEvent.press(getByTestId('compare-picker-item-3'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
