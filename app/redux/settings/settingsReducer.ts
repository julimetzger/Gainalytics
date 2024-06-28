import {AnyAction} from "@reduxjs/toolkit";

export interface AppSettings {
    mode: 'light' | 'dark',
    localNotification?: {
        pauseTimerInSeconds?: number
        finishTrainingTimerInSeconds?: number
    }
}

const initialState = {
    mode: 'dark'
} as AppSettings;

const settingsReducer = (settings: AppSettings = initialState, action: AnyAction) => {
    switch (action.type) {
        case 'TOGGLE_MODE': {
            return {
                mode: settings?.mode === 'dark' ? 'light' : 'dark'
            } as AppSettings;
        }
        case 'SET_PAUSE_TIMER': {
            return {
                ...settings,
                localNotification: {
                    ...settings.localNotification,
                    pauseTimerInSeconds: action.seconds
                }
            } as AppSettings;
        }
        case 'SET_FINISH_TRAINING_TIMER': {
            return {
                ...settings,
                localNotification: {
                    ...settings.localNotification,
                    finishTrainingTimerInSeconds: action.seconds
                }
            } as AppSettings;
        }
        default:
            return settings;
    }
}

export default settingsReducer;
