/**
 * Unit tests for useVelocityLossInsights — scoping by trainingWorkoutIds (GH-244).
 *
 * Scenario: micro 1 has two trainings (A and B).
 *   Training A → workout 101 (exerciseId 10, 1 DONE video, VL 20%)
 *   Training B → workout 102 (exerciseId 10, 1 DONE video, VL 35%)
 *              → workout 103 (exerciseId 11, 1 DONE video, VL 40%)
 *
 * Without scoping: insights for exercise 10 and 11 across the whole micro.
 * Scoped to A (workout 101): only exercise 10, VL = 20%.
 * Scoped to B (workouts 102+103): exercise 10 (VL 35%) and 11 (VL 40%).
 */

import React, {useRef} from 'react';
import {View} from 'react-native';
import {render} from '@testing-library/react-native';
import {useVelocityLossInsights, VLInsightData} from '../../../app/components/Training/useVelocityLossInsights';
import {VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';

// We need a mutable state so individual tests can control it.
let MOCK_STATE: any;

jest.mock('react-redux', () => ({
  useSelector: jest.fn((selector: (state: any) => any) => selector(MOCK_STATE)),
}));

const PLAN: Partial<TrainingsPlan> = {
  id: 1,
  name: 'Plan',
  trainingNames: {1: 'A', 2: 'B'},
  trainings: {
    '1,1': 10, // micro 1, slot 1 → training A (id 10)
    '1,2': 20, // micro 1, slot 2 → training B (id 20)
  },
  mesos: [],
};

function makeState() {
  return {
    trainings: {
      byId: {
        10: {id: 10, doneWorkoutIds: {10: 101}},
        20: {id: 20, doneWorkoutIds: {10: 102, 11: 103}},
      },
    },
    workouts: {
      byId: {
        101: {id: 101, exerciseId: 10, sets: [{index: 0, weight: 100, reps: 5, rir: 2}]},
        102: {id: 102, exerciseId: 10, sets: [{index: 0, weight: 120, reps: 5, rir: 2}]},
        103: {id: 103, exerciseId: 11, sets: [{index: 0, weight: 80, reps: 5, rir: 2}]},
      },
    },
    exercises: {
      byId: {
        10: {id: 10, name: 'Squat'},
        11: {id: 11, name: 'Bench'},
      },
    },
    videoAnalyses: {
      allIds: [1, 2, 3],
      byId: {
        1: {
          id: 1,
          exerciseId: 10,
          workoutId: 101,
          setIndex: 0,
          status: VideoAnalysisStatus.DONE,
          sourceUri: 'file://a.mp4',
          createdAt: new Date(),
          videoMeta: {durationMs: 1000, fps: 30, width: 1080, height: 1920},
          setResult: {velocityLossPercent: 20},
        },
        2: {
          id: 2,
          exerciseId: 10,
          workoutId: 102,
          setIndex: 0,
          status: VideoAnalysisStatus.DONE,
          sourceUri: 'file://b.mp4',
          createdAt: new Date(),
          videoMeta: {durationMs: 1000, fps: 30, width: 1080, height: 1920},
          setResult: {velocityLossPercent: 35},
        },
        3: {
          id: 3,
          exerciseId: 11,
          workoutId: 103,
          setIndex: 0,
          status: VideoAnalysisStatus.DONE,
          sourceUri: 'file://c.mp4',
          createdAt: new Date(),
          videoMeta: {durationMs: 1000, fps: 30, width: 1080, height: 1920},
          setResult: {velocityLossPercent: 40},
        },
      },
    },
  };
}

/** Tiny helper: renders the hook and captures its return value synchronously. */
function useHookResult<T>(useHook: () => T): T {
  let captured: T;
  const Wrapper = () => {
    // Use ref so we only capture once on mount
    const ref = useRef<T>(useHook());
    captured = ref.current;
    return <View />;
  };
  render(<Wrapper />);
  return captured!;
}

beforeEach(() => {
  MOCK_STATE = makeState();
});

describe('useVelocityLossInsights — trainingWorkoutIds scoping', () => {
  it('without scoping returns insights for all exercises in the micro', () => {
    const insights = useHookResult(() => useVelocityLossInsights(PLAN as any, 1));
    const ids = insights.map((i: VLInsightData) => i.exerciseId).sort();
    expect(ids).toEqual([10, 11]);
  });

  it('scoped to training A (workout 101): only exercise 10 with VL 20%', () => {
    const insights = useHookResult(() =>
      useVelocityLossInsights(PLAN as any, 1, new Set([101])),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].exerciseId).toBe(10);
    expect(insights[0].currentVlPercent).toBe(20);
  });

  it('scoped to training B (workouts 102, 103): exercise 10 (VL 35%) and 11 (VL 40%)', () => {
    const insights = useHookResult(() =>
      useVelocityLossInsights(PLAN as any, 1, new Set([102, 103])),
    );
    const ids = insights.map((i: VLInsightData) => i.exerciseId).sort();
    expect(ids).toEqual([10, 11]);
    const squat = insights.find((i: VLInsightData) => i.exerciseId === 10)!;
    expect(squat.currentVlPercent).toBe(35);
  });

  it('scoped to a workout with no linked videos: returns empty array', () => {
    const insights = useHookResult(() =>
      useVelocityLossInsights(PLAN as any, 1, new Set([999])),
    );
    expect(insights).toHaveLength(0);
  });
});
