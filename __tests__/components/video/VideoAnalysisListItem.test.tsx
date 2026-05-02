import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import VideoAnalysisListItem from '../../../app/components/video/VideoAnalysisListItem';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {useExercise} from '../../../app/redux/Exercises/use/useExercise';
import {useTrainingMetadataByWorkoutId} from '../../../app/redux/Workout/use/useTrainingMetadataByWorkoutId';
import {useWorkoutById} from '../../../app/redux/Workout/use/useWorkoutById';

jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useTrainingMetadataByWorkoutId', () => ({
  useTrainingMetadataByWorkoutId: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return {
    Icon: ({source}: {source: string}) => <Text>{source}</Text>,
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    TouchableRipple: ({children, onPress, testID}: {children: React.ReactNode; onPress?: () => void; testID?: string}) => (
      <TouchableOpacity onPress={onPress} testID={testID}>
        <View>{children}</View>
      </TouchableOpacity>
    ),
    useTheme: () => ({
      colors: {
        primary: '#4f6ef7',
        primaryContainer: '#dce2ff',
        onPrimaryContainer: '#1c2b7a',
        error: '#b3261e',
        errorContainer: '#f9dedc',
        onErrorContainer: '#410e0b',
        surface: '#15171c',
        surfaceVariant: '#23262f',
        onSurfaceVariant: '#bac0cf',
        outlineVariant: '#343845',
        scrim: '#000000',
        elevation: {
          level2: '#1b1e25',
          level3: '#30343f',
        },
      },
    }),
  };
});

const mockedUseExercise = jest.mocked(useExercise);
const mockedUseTrainingMetadataByWorkoutId = jest.mocked(useTrainingMetadataByWorkoutId);
const mockedUseWorkoutById = jest.mocked(useWorkoutById);

function createAnalysis(status: VideoAnalysisStatus, overrides?: Partial<VideoAnalysis>): VideoAnalysis {
  return {
    id: 1,
    exerciseId: 11,
    workoutId: 101,
    setIndex: 0,
    sourceUri: 'file://analysis.mp4',
    createdAt: new Date('2026-04-29T18:42:00.000Z'),
    status,
    videoMeta: {
      durationMs: 1000,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    ...overrides,
  };
}

describe('VideoAnalysisListItem', () => {
  beforeEach(() => {
    mockedUseExercise.mockReturnValue({id: 11, name: 'Back Squat'});
    mockedUseTrainingMetadataByWorkoutId.mockReturnValue({trainingName: 'Lower A', micro: 7});
    mockedUseWorkoutById.mockReturnValue({
      id: 101,
      exerciseId: 11,
      sets: [{index: 0, reps: 5, rir: 2, weight: 165}],
    });
  });

  it('renders the compact done state and opens the detail row on tap', () => {
    const onPress = jest.fn();
    const {getByTestId, getByText} = render(
      <VideoAnalysisListItem
        analysis={createAnalysis(VideoAnalysisStatus.DONE, {
          setResult: {
            repResults: [],
            velocityLossPercent: 14.29,
            rirEstimate: '2',
          },
        })}
        onPress={onPress}
      />,
    );

    expect(getByText('Back Squat')).toBeTruthy();
    expect(getByText('165 kg × 5')).toBeTruthy();
    expect(getByText('VL 14.3% · RIR 2')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
    expect(getByText('M7')).toBeTruthy();

    fireEvent.press(getByTestId('video-analysis-row-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the failed state without a rep count and shows the inline error', () => {
    mockedUseWorkoutById.mockReturnValue({
      id: 101,
      exerciseId: 11,
      sets: [{index: 0, reps: 5, rir: 2, weight: 170}],
    });

    const {getByText, queryByText} = render(
      <VideoAnalysisListItem analysis={createAnalysis(VideoAnalysisStatus.FAILED, {error: 'No outer plate candidate found at t=0'})} onPress={jest.fn()} />,
    );

    expect(getByText('170 kg')).toBeTruthy();
    expect(queryByText('170 kg × 5')).toBeNull();
    expect(getByText('No outer plate candidate found at t=0')).toBeTruthy();
    expect(getByText('Failed')).toBeTruthy();
  });

  it('renders queued analyses without metrics and keeps secondary actions available', () => {
    const onDelete = jest.fn();
    const onLink = jest.fn();
    const {getByTestId, getByText, queryByText} = render(
      <VideoAnalysisListItem analysis={createAnalysis(VideoAnalysisStatus.PROCESSING, {workoutId: undefined})} onPress={jest.fn()} onDelete={onDelete} onLink={onLink} />,
    );

    expect(getByText('Queued')).toBeTruthy();
    expect(queryByText(/VL /)).toBeNull();

    fireEvent.press(getByTestId('video-analysis-link-set-1'));
    fireEvent.press(getByTestId('video-analysis-delete-1'));

    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
