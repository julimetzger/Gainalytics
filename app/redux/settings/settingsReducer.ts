import {AnyAction} from "@reduxjs/toolkit";

export interface AppSettings {
    mode: 'light' | 'dark'
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
        default:
            return settings;
    }
}

export default settingsReducer;
