import settingsReducer, {AppSettings} from '../../app/redux/settings/settingsReducer';

describe('settingsReducer rest timer actions', () => {
  const base: AppSettings = {mode: 'dark', palette: 'blue'};

  it('starts a new active rest entry with epoch + target', () => {
    const next = settingsReducer(base, {
      type: 'START_REST_TIMER',
      startedAt: 1000,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 1000,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('updates the target on UPDATE_REST_TIMER_TARGET without changing startedAt', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {
      type: 'UPDATE_REST_TIMER_TARGET',
      targetSeconds: 120,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 500,
      targetSeconds: 120,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('resets the timer by replacing startedAt only', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {
      type: 'RESET_REST_TIMER',
      startedAt: 800,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 800,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('dismisses the timer', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {type: 'DISMISS_REST_TIMER'} as any);
    expect(next.restTimer?.active).toBeNull();
  });

  it('sets the per-exercise default without overwriting other entries', () => {
    const seeded: AppSettings = {
      ...base,
      restTimer: {defaultPerExercise: {1: 60}},
    };
    const next = settingsReducer(seeded, {
      type: 'SET_REST_TIMER_EXERCISE_DEFAULT',
      exerciseId: 2,
      seconds: 120,
    } as any);
    expect(next.restTimer?.defaultPerExercise).toEqual({1: 60, 2: 120});
  });
});
