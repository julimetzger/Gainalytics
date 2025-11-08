import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';

describe('settingsReducer', () => {
  it('should toggle mode', () => {
    const initialState = {
      mode: 'dark',
    } as AppSettings;
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
    } as AppSettings;
    const action = {
      type: 'SET_PAUSE_TIMER',
      seconds: 10,
    };
    const expectedState = {
      localNotification: {
        pauseTimerInSeconds: 10,
      },
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should delete pause timer', () => {
    const initialState = {
      localNotification: {
        pauseTimerInSeconds: 10,
      },
    } as AppSettings;
    const action = {
      type: 'SET_PAUSE_TIMER',
      seconds: undefined,
    };
    const expectedState = {
      localNotification: {
        pauseTimerInSeconds: undefined,
      },
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should set finish training timer', () => {
    const initialState = {
      localNotification: {
        finishTrainingTimerInSeconds: undefined,
      },
    } as AppSettings;
    const action = {
      type: 'SET_FINISH_TRAINING_TIMER',
      seconds: 10,
    };
    const expectedState = {
      localNotification: {
        finishTrainingTimerInSeconds: 10,
      },
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });

  it('should delete finish training timer', () => {
    const initialState = {
      localNotification: {
        finishTrainingTimerInSeconds: 10,
      },
    } as AppSettings;
    const action = {
      type: 'SET_FINISH_TRAINING_TIMER',
      seconds: undefined,
    };
    const expectedState = {
      localNotification: {
        finishTrainingTimerInSeconds: undefined,
      },
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
    } as AppSettings;
    const action = {
      type: 'TOGGLE_ENABLE_1RM_BUTTON',
    };
    const expectedState = {
      toggles: {
        disable1RMButton: expected,
      },
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
    } as AppSettings;
    const action = {
      type: 'TOGGLE_DISABLE_TIMER',
    };
    const expectedState = {
      toggles: {
        disableTimer: expected,
      },
    };
    expect(settingsReducer(initialState, action)).toEqual(expectedState);
  });
});
