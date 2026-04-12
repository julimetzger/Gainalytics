import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';
import {Metric} from '../../../app/models/Metric';

describe('settingsReducer', () => {
  it('should toggle mode', () => {
    const initialState = {
      mode: 'dark',
    } satisfies AppSettings;
    const action = {
      type: 'TOGGLE_MODE',
    };
    const expectedState = {
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should set pause timer', () => {
    const initialState = {
      localNotification: {
        pauseTimerInSeconds: undefined,
      },
      mode: 'dark',
    } satisfies AppSettings;
    const action = {
      type: 'SET_PAUSE_TIMER',
      seconds: 10,
    };
    const expectedState = {
      localNotification: {
        pauseTimerInSeconds: 10,
      },
      mode: 'dark',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should delete pause timer', () => {
    const initialState = {
      localNotification: {
        pauseTimerInSeconds: 10,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'SET_PAUSE_TIMER',
      seconds: undefined,
    };
    const expectedState = {
      localNotification: {
        pauseTimerInSeconds: undefined,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should set finish training timer', () => {
    const initialState = {
      localNotification: {
        finishTrainingTimerInSeconds: undefined,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'SET_FINISH_TRAINING_TIMER',
      seconds: 10,
    };
    const expectedState = {
      localNotification: {
        finishTrainingTimerInSeconds: 10,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should delete finish training timer', () => {
    const initialState = {
      localNotification: {
        finishTrainingTimerInSeconds: 10,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'SET_FINISH_TRAINING_TIMER',
      seconds: undefined,
    };
    const expectedState = {
      localNotification: {
        finishTrainingTimerInSeconds: undefined,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it.each([
    {inital: undefined, expected: true},
    {inital: true, expected: false},
    {inital: false, expected: true},
  ])('should toggle 1RM for %s', ({inital, expected}) => {
    const initialState = {
      toggles: {
        disable1RMButton: inital,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'TOGGLE_ENABLE_1RM_BUTTON',
    };
    const expectedState = {
      toggles: {
        disable1RMButton: expected,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it.each([
    {inital: undefined, expected: true},
    {inital: true, expected: false},
    {inital: false, expected: true},
  ])('should toggle showTimer for %s', ({inital, expected}) => {
    const initialState = {
      toggles: {
        disableTimer: inital,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'TOGGLE_DISABLE_TIMER',
    };
    const expectedState = {
      toggles: {
        disableTimer: expected,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it.each([
    {inital: undefined, expected: true},
    {inital: true, expected: false},
    {inital: false, expected: true},
  ])('should toggle showToasts for %s', ({inital, expected}) => {
    const initialState = {
      toggles: {
        disableToasts: inital,
      },
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'TOGGLE_DISABLE_TOASTS',
    };
    const expectedState = {
      toggles: {
        disableToasts: expected,
      },
      mode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should persist a muscle metric slot without affecting exercise defaults', () => {
    const initialState = {
      mode: 'light',
    } satisfies AppSettings;
    const action = {
      type: 'SET_METRIC_OVERVIEW_SLOT',
      section: 'muscles',
      slotIndex: 1,
      metric: Metric.AVERAGE_INTENSITY,
    };
    const expectedState = {
      mode: 'light',
      metricOverview: {
        muscles: [Metric.VOLUME, Metric.AVERAGE_INTENSITY, Metric.REPS],
      },
    };

    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should update an exercise metric slot while keeping the other stored slots', () => {
    const initialState = {
      mode: 'dark',
      metricOverview: {
        exercises: [Metric.ONE_RM, Metric.REPS, Metric.MAX_INTENSITY],
      },
    } satisfies AppSettings;
    const action = {
      type: 'SET_METRIC_OVERVIEW_SLOT',
      section: 'exercises',
      slotIndex: 0,
      metric: Metric.AVERAGE_INTENSITY,
    };
    const expectedState = {
      mode: 'dark',
      metricOverview: {
        exercises: [Metric.AVERAGE_INTENSITY, Metric.REPS, Metric.MAX_INTENSITY],
      },
    };

    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });
});
