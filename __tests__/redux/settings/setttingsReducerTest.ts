import settingsReducer, {AppSettings} from "../../../app/redux/settings/settingsReducer";
import {tr} from "react-native-paper-dates";

describe('settingsReducer', () => {
    it('should toggle mode', () => {
        const initialState = {
            mode: 'dark'
        } as AppSettings
        const action = {
            type: 'TOGGLE_MODE'
        };
        const expectedState = {
            mode: 'light'
        };
        expect(settingsReducer(initialState, action)).toEqual(expectedState);
    })

    it.each([
        {inital: undefined, expected: true},
        {inital: true, expected: false},
        {inital: false, expected: true}
    ])('should toggle 1RM for %s', ({inital, expected}) => {
        const initialState = {
            toggles: {
                disable1RMButton: inital
            }
        } as AppSettings
        const action = {
            type: 'TOGGLE_ENABLE_1RM_BUTTON'
        };
        const expectedState = {
            toggles: {
                disable1RMButton: expected
            }
        };
        expect(settingsReducer(initialState, action)).toEqual(expectedState);

    });

    it.each([
        {inital: undefined, expected: true},
        {inital: true, expected: false},
        {inital: false, expected: true}
    ])('should toggle showTimer for %s', ({inital, expected}) => {
        const initialState = {
            toggles: {
                disableTimer: inital
            }
        } as AppSettings
        const action = {
            type: 'TOGGLE_DISABLE_TIMER'
        };
        const expectedState = {
            toggles: {
                disableTimer: expected
            }
        };
        expect(settingsReducer(initialState, action)).toEqual(expectedState);

    });
})
