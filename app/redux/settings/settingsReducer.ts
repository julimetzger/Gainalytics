import {AnyAction} from "@reduxjs/toolkit";

export interface AppSettings {
    mode: 'light' | 'dark',
    localNotification?: {
        pauseTimerInSeconds?: number
        finishTrainingTimerInSeconds?: number
    }
    toggles?: {
        useRpe?: boolean
        disable1RMButton?: boolean,
        disableTimer?: boolean,
        showPlusButtonLeft?: boolean
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
        case 'TOGGLE_USE_RPE': {
            return {
                ...settings,
                toggles: {
                    ...settings.toggles,
                    useRpe: !settings.toggles?.useRpe
                }

            } as AppSettings;
        }
        case 'TOGGLE_ENABLE_1RM_BUTTON': {
            return {
                ...settings,
                toggles: {
                    ...settings.toggles,
                    disable1RMButton: !settings.toggles?.disable1RMButton
                }
            } as AppSettings;
        }
        case 'TOGGLE_DISABLE_TIMER': {
            return {
                ...settings,
                toggles: {
                    ...settings.toggles,
                    disableTimer: !settings.toggles?.disableTimer
                }
            } as AppSettings;
        }
        case 'SHOW_PLUS_BUTTON_LEFT': {
            return {
                ...settings,
                toggles: {
                    ...settings.toggles,
                    showPlusButtonLeft: !settings.toggles?.showPlusButtonLeft
                }
            } as AppSettings;
        }
        default:
            return settings;
    }
}

export default settingsReducer;
