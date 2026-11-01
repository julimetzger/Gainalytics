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
    // GH-404: the legacy flag and the new three-way selection are kept in sync,
    // so nothing can end up reading two different modes.
    const expectedState = {
      mode: 'light',
      themeMode: 'light',
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it.each([
    {themeMode: 'system', expectedMode: 'dark'},
    {themeMode: 'light', expectedMode: 'light'},
    {themeMode: 'dark', expectedMode: 'dark'},
  ])('should set the theme mode to $themeMode', ({themeMode, expectedMode}) => {
    const initialState = {
      mode: 'dark',
      themeMode: 'dark',
    } satisfies AppSettings;
    const action = {
      type: 'SET_THEME_MODE',
      themeMode,
    };
    // 'system' has no legacy equivalent, so `mode` keeps the last explicit value.
    const expectedState = {
      mode: expectedMode,
      themeMode,
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
      restTimer: {
        userDefaultSeconds: 10,
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
      restTimer: {
        userDefaultSeconds: undefined,
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

  it('should set aiChatPrompt', () => {
    const initialState = {mode: 'dark'} satisfies AppSettings;
    const action = {type: 'SET_AI_CHAT_PROMPT', prompt: 'Custom chat prompt'};
    const result = settingsReducer(initialState, action);
    expect(result.aiChatPrompt).toBe('Custom chat prompt');
  });

  it('should clear aiChatPrompt on reset', () => {
    const initialState = {mode: 'dark', aiChatPrompt: 'Custom chat prompt'} satisfies AppSettings;
    const action = {type: 'RESET_AI_CHAT_PROMPT'};
    const result = settingsReducer(initialState, action);
    expect(result.aiChatPrompt).toBeUndefined();
  });

  it('should set aiChatPrompt to undefined when empty string', () => {
    const initialState = {mode: 'dark', aiChatPrompt: 'Custom'} satisfies AppSettings;
    const action = {type: 'SET_AI_CHAT_PROMPT', prompt: '  '};
    const result = settingsReducer(initialState, action);
    expect(result.aiChatPrompt).toBeUndefined();
  });

  it('should set aiTrainingPrompt', () => {
    const initialState = {mode: 'dark'} satisfies AppSettings;
    const action = {type: 'SET_AI_TRAINING_PROMPT', prompt: 'Custom training prompt'};
    const result = settingsReducer(initialState, action);
    expect(result.aiTrainingPrompt).toBe('Custom training prompt');
  });

  it('should clear aiTrainingPrompt on reset', () => {
    const initialState = {mode: 'dark', aiTrainingPrompt: 'Custom training prompt'} satisfies AppSettings;
    const action = {type: 'RESET_AI_TRAINING_PROMPT'};
    const result = settingsReducer(initialState, action);
    expect(result.aiTrainingPrompt).toBeUndefined();
  });

  it('GH-645: sets the trimmed aiSessionPrompt and leaves the training prompt alone', () => {
    const initialState = {mode: 'dark', aiTrainingPrompt: 'Micro prompt'} satisfies AppSettings;
    const result = settingsReducer(initialState, {type: 'SET_AI_SESSION_PROMPT', prompt: '  Session prompt  '});
    expect(result).toEqual({mode: 'dark', aiTrainingPrompt: 'Micro prompt', aiSessionPrompt: 'Session prompt'});
  });

  it('GH-645: clears aiSessionPrompt on reset and on an empty save', () => {
    const initialState = {mode: 'dark', aiSessionPrompt: 'Session prompt'} satisfies AppSettings;
    expect(settingsReducer(initialState, {type: 'RESET_AI_SESSION_PROMPT'})).toEqual({mode: 'dark', aiSessionPrompt: undefined});
    expect(settingsReducer(initialState, {type: 'SET_AI_SESSION_PROMPT', prompt: '   '})).toEqual({mode: 'dark', aiSessionPrompt: undefined});
  });
});
