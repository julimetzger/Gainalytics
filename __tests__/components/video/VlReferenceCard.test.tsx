/**
 * GH-316: VL reference (Eichung) driven from a video-analysis result.
 *
 * Uses a real store so the whole round trip is exercised — dispatch, reducer,
 * selector, re-render — instead of asserting on a mocked dispatch.
 */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {PaperProvider} from 'react-native-paper';
import rootReducer from '../../../app/redux/rootReducer';
import VlReferenceCard from '../../../app/components/video/VlReferenceCard';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';

// jest.setup.js stubs useSelector globally to return [] — this suite drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const SQUAT_ID = 2;
const WORKOUT_ID = 501;

const makeAnalysis = (overrides?: Partial<VideoAnalysis>): VideoAnalysis => ({
  id: 1,
  exerciseId: SQUAT_ID,
  workoutId: WORKOUT_ID,
  setIndex: 1,
  sourceUri: 'content://squat.mp4',
  createdAt: new Date('2026-03-15T10:00:00.000Z'),
  status: VideoAnalysisStatus.DONE,
  videoMeta: {durationMs: 5000, fps: 30, width: 1920, height: 1080},
  setResult: {repResults: [], velocityLossPercent: 14.29, rirEstimate: '3-4'},
  ...overrides,
});

const renderCard = (analysis: VideoAnalysis, reportedRir = 1) => {
  // Seed the linked workout through preloadedState — ADD_WORKOUT assigns its own id.
  const initialState = configureStore({reducer: rootReducer as any}).getState() as any;
  const store = configureStore({
    reducer: rootReducer as any,
    preloadedState: {
      ...initialState,
      workouts: {
        ...initialState.workouts,
        byId: {[WORKOUT_ID]: {id: WORKOUT_ID, exerciseId: SQUAT_ID, sets: [{index: 1, reps: 3, rir: reportedRir, weight: 200}]}},
        allIds: [WORKOUT_ID],
      },
    },
  });
  const utils = render(
    <Provider store={store}>
      <PaperProvider>
        <VlReferenceCard analysis={analysis} />
      </PaperProvider>
    </Provider>,
  );
  return {...utils, store};
};

describe('VlReferenceCard – setting a reference', () => {
  it('shows the global estimate first and the scaled one after anchoring at RIR 1', () => {
    const {getByTestId, queryByTestId} = renderCard(makeAnalysis());

    // Before: 14.29% VL on the untouched global curve.
    expect(getByTestId('vl-reference-rir-estimate').props.children).toBe('RIR 3-4');
    expect(queryByTestId('vl-reference-badge')).toBeNull();
    expect(getByTestId('vl-reference-global-hint')).toBeTruthy();

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-rir-option-1'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));

    // After: the same VL now reads as the band containing the confirmed RIR.
    expect(getByTestId('vl-reference-rir-estimate').props.children).toBe('RIR 1-2');
    expect(getByTestId('vl-reference-badge').props.children).toContain('RIR 1');
    expect(queryByTestId('vl-reference-global-hint')).toBeNull();
  });

  it('writes exactly one reference onto the exercise, carrying the analysed set identity', () => {
    const {getByTestId, store} = renderCard(makeAnalysis());

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-rir-option-2'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));

    const stored = (store.getState() as any).exercises.byId[SQUAT_ID].vlReference;
    expect({...stored, referencedAt: typeof stored.referencedAt}).toEqual({
      rir: 2,
      velocityLossPercent: 14.29,
      referencedAt: 'string',
      analysisId: 1,
      workoutId: WORKOUT_ID,
      setIndex: 1,
    });
  });

  it('replaces the previous reference rather than adding a second one', () => {
    const {getByTestId, store} = renderCard(makeAnalysis());

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-rir-option-0'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));
    expect((store.getState() as any).exercises.byId[SQUAT_ID].vlReference.rir).toBe(0);

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-rir-option-3'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));
    expect((store.getState() as any).exercises.byId[SQUAT_ID].vlReference.rir).toBe(3);
  });

  it('leaves every other exercise on the global curve', () => {
    const {getByTestId, store} = renderCard(makeAnalysis());

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));

    const exercises = (store.getState() as any).exercises;
    const referenced = exercises.allIds.filter((id: number) => exercises.byId[id].vlReference !== undefined);
    expect(referenced).toEqual([SQUAT_ID]);
  });
});

describe('VlReferenceCard – removing a reference', () => {
  it('returns the exercise to the global estimate', () => {
    const {getByTestId, queryByTestId, store} = renderCard(makeAnalysis());

    fireEvent.press(getByTestId('vl-reference-set-button'));
    fireEvent.press(getByTestId('vl-reference-rir-option-1'));
    fireEvent.press(getByTestId('vl-reference-dialog-confirm'));
    expect(getByTestId('vl-reference-rir-estimate').props.children).toBe('RIR 1-2');

    fireEvent.press(getByTestId('vl-reference-remove-button'));

    expect(getByTestId('vl-reference-rir-estimate').props.children).toBe('RIR 3-4');
    expect(queryByTestId('vl-reference-badge')).toBeNull();
    expect((store.getState() as any).exercises.byId[SQUAT_ID].vlReference).toBeUndefined();
  });
});

describe('VlReferenceCard – locked cases', () => {
  it('locks the action and names the RIR when the set was logged beyond RIR 3', () => {
    const {getByTestId} = renderCard(makeAnalysis(), 5);

    expect(getByTestId('vl-reference-blocked-reason').props.children).toBe(
      'This set was logged at RIR 5. Only sets taken to RIR 0–3 can anchor the curve — further from failure the velocity signal is too flat.',
    );
    expect(getByTestId('vl-reference-set-button').props.accessibilityState.disabled).toBe(true);
  });

  it('locks the action when the analysis has no measured velocity loss', () => {
    const {getByTestId} = renderCard(makeAnalysis({setResult: {repResults: [], velocityLossPercent: null, rirEstimate: null}}));

    expect(getByTestId('vl-reference-blocked-reason').props.children).toBe(
      'This set has no measured velocity loss yet. Confirm its reps in the playback overlay and save the set result first.',
    );
    expect(getByTestId('vl-reference-set-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('vl-reference-rir-estimate').props.children).toBe('RIR –');
  });

  it('locks the action when the analysis is not linked to an exercise', () => {
    const {getByTestId} = renderCard(makeAnalysis({exerciseId: undefined, workoutId: undefined}));

    expect(getByTestId('vl-reference-blocked-reason').props.children).toBe(
      'Link this analysis to a workout set first — a VL reference always belongs to one exercise.',
    );
    expect(getByTestId('vl-reference-set-button').props.accessibilityState.disabled).toBe(true);
  });

  it('offers only RIR 0–3 as anchors in the dialog', () => {
    const {getByTestId, queryByTestId} = renderCard(makeAnalysis());

    fireEvent.press(getByTestId('vl-reference-set-button'));

    [0, 1, 2, 3].forEach((rir) => expect(getByTestId(`vl-reference-rir-option-${rir}`)).toBeTruthy());
    [4, 5].forEach((rir) => expect(queryByTestId(`vl-reference-rir-option-${rir}`)).toBeNull());
  });
});
