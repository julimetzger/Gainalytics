import {useEffect, useMemo} from 'react';
import {AppState} from 'react-native';
import {useHealthConnectActions, useHealthConnectConnection, useRecoveryData} from './useHealthConnect';
import {canReadSleep, canReadSteps} from '../../../utils/healthConnect/healthConnectStatus';
import {buildRecoveryDays, recoveryUnavailableHint, serializeRecoveryDays} from '../../../utils/healthConnect/recovery';

export interface RecoveryContext {
  /** At least one of READ_SLEEP / READ_STEPS is granted, so the opt-in switch can be offered. */
  available: boolean;
  /** Why the switch is not offered; null when it is. */
  hint: string | null;
  /** The recovery section for the prompt; null unless switched on, allowed and with data. */
  json: string | null;
  dayCount: number;
  error?: string;
}

/**
 * GH-619: sleep and steps of the chat's range. Reads Health Connect only while the opt-in is on
 * and uses each part only while its permission is granted — without the switch nothing from
 * Health Connect is read for, or sent with, the chat.
 */
export const useRecoveryContext = (startDate: Date, endDate: Date, enabled: boolean): RecoveryContext => {
  const connection = useHealthConnectConnection();
  const recovery = useRecoveryData();
  const {loadRecovery} = useHealthConnectActions();
  const sleepAllowed = canReadSleep(connection);
  const stepsAllowed = canReadSteps(connection);
  const available = sleepAllowed || stepsAllowed;
  const active = enabled && available;
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  useEffect(() => {
    if (!active) return;
    loadRecovery(startMs, endMs);
    // The chat stays mounted in the drawer: sleep and steps synced while the app was in the
    // background must reach the next request, so read them again on every return to the foreground.
    const subscription = AppState.addEventListener('change', (appState) => appState === 'active' && loadRecovery(startMs, endMs));
    return () => subscription.remove();
  }, [active, sleepAllowed, stepsAllowed, startMs, endMs, loadRecovery]);

  const days = useMemo(
    () =>
      active && recovery
        ? buildRecoveryDays(sleepAllowed ? recovery.sleep ?? [] : [], stepsAllowed ? recovery.steps ?? [] : [], new Date(startMs), new Date(endMs))
        : [],
    [active, recovery, sleepAllowed, stepsAllowed, startMs, endMs],
  );
  const json = useMemo(() => serializeRecoveryDays(days), [days]);

  return {
    available,
    hint: recoveryUnavailableHint(connection),
    json,
    dayCount: days.length,
    error: active ? recovery?.error : undefined,
  };
};
