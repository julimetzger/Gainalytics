/**
 * GH-316: an analysis filmed inside a session carries no `exerciseId` of its own — it is
 * linked to its exercise through the workout. The card and the list row already resolved it
 * that way; the detail screen did not, so the same analysis showed the scaled RIR in the list
 * and the global one on the detail screen. Both must read the same reference.
 */
import React from 'react';
import {renderHook} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import rootReducer from '../../../app/redux/rootReducer';
import {useVideoAnalysisExerciseId} from '../../../app/redux/VideoAnalysis/use/useVideoAnalysisExerciseId';
import {useExerciseVlReference} from '../../../app/redux/Exercises/use/useExerciseVlReference';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {VelocityLossReference} from '../../../app/models/entities/Exercise';

// jest.setup.js stubs useSelector globally to return [] — this suite drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const SQUAT_ID = 2;
const BENCH_ID = 3;
const WORKOUT_ID = 501;

const SQUAT_REFERENCE: VelocityLossReference = {
  rir: 1,
  velocityLossPercent: 28,
  referencedAt: '2026-03-15T10:00:00.000Z',
  analysisId: 1,
  workoutId: WORKOUT_ID,
  setIndex: 1,
};

const makeAnalysis = (overrides?: Partial<VideoAnalysis>): VideoAnalysis => ({
  id: 1,
  workoutId: WORKOUT_ID,
  setIndex: 1,
  sourceUri: 'content://squat.mp4',
  createdAt: new Date('2026-03-15T10:00:00.000Z'),
  status: VideoAnalysisStatus.DONE,
  videoMeta: {durationMs: 5000, fps: 30, width: 1920, height: 1080},
  setResult: {repResults: [], velocityLossPercent: 28, rirEstimate: '2-3'},
  ...overrides,
});

const makeStore = () => {
  const initialState = configureStore({reducer: rootReducer as any}).getState() as any;
  return configureStore({
    reducer: rootReducer as any,
    preloadedState: {
      ...initialState,
      exercises: {
        ...initialState.exercises,
        byId: {
          [SQUAT_ID]: {id: SQUAT_ID, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE},
          [BENCH_ID]: {id: BENCH_ID, name: 'Bench', muscles: []},
        },
        allIds: [SQUAT_ID, BENCH_ID],
      },
      workouts: {
        ...initialState.workouts,
        byId: {[WORKOUT_ID]: {id: WORKOUT_ID, exerciseId: SQUAT_ID, sets: [{index: 1, reps: 3, rir: 1, weight: 200}]}},
        allIds: [WORKOUT_ID],
      },
    },
  });
};

const renderResolution = (analysis?: VideoAnalysis) => {
  const store = makeStore();
  const wrapper = ({children}: {children: React.ReactNode}) => <Provider store={store}>{children}</Provider>;
  return renderHook(
    () => {
      const exerciseId = useVideoAnalysisExerciseId(analysis);
      return {exerciseId, vlReference: useExerciseVlReference(exerciseId)};
    },
    {wrapper},
  );
};

describe('useVideoAnalysisExerciseId', () => {
  it('resolves the exercise through the workout when the analysis has no exerciseId of its own', () => {
    const {result} = renderResolution(makeAnalysis());

    expect(result.current.exerciseId).toBe(SQUAT_ID);
    // The detail screen must see the very same reference the card and the list row see.
    expect(result.current.vlReference).toEqual(SQUAT_REFERENCE);
  });

  it('prefers the analysis own exerciseId over the workout link', () => {
    const {result} = renderResolution(makeAnalysis({exerciseId: BENCH_ID}));

    expect(result.current.exerciseId).toBe(BENCH_ID);
    expect(result.current.vlReference).toBeUndefined();
  });

  it('stays on the global curve for an analysis with no link at all', () => {
    const {result} = renderResolution(makeAnalysis({workoutId: undefined}));

    expect(result.current.exerciseId).toBeUndefined();
    expect(result.current.vlReference).toBeUndefined();
  });

  it('returns undefined while the analysis itself is still loading', () => {
    const {result} = renderResolution(undefined);

    expect(result.current.exerciseId).toBeUndefined();
    expect(result.current.vlReference).toBeUndefined();
  });
});
