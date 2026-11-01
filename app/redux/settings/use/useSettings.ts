import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {AppSettings} from '../settingsReducer';

export const useSettings = () => useSelector((state: GlobalState) => state.settings);

/**
 * GH-671: one value out of the settings. The running rest timer lives in the
 * settings too (`restTimer.active`), so every logged set replaces the whole
 * settings object — a component on `useSettings()` re-renders on each "Add"
 * even when it only reads a toggle. [select] must return a primitive or an
 * object of the settings itself (no new object per call).
 */
export const useSettingsSelector = <T>(select: (settings: AppSettings) => T): T => useSelector((state: GlobalState) => select(state.settings));
