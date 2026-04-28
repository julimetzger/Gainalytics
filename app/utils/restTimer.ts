import {useEffect, useMemo, useRef, useState} from 'react';
import {AppState, AppStateStatus} from 'react-native';

export type RestTimerState = 'counting' | 'overrun' | 'idle';

export interface RestTimerSnapshot {
  state: RestTimerState;
  display: string;
  elapsedSeconds: number;
  remainingSeconds: number;
}

export const formatRestDisplay = (targetSeconds: number, elapsedSeconds: number): RestTimerSnapshot => {
  if (targetSeconds <= 0) {
    return {state: 'idle', display: '00:00', elapsedSeconds: 0, remainingSeconds: 0};
  }
  const remaining = targetSeconds - elapsedSeconds;
  if (remaining > 0) {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return {
      state: 'counting',
      display: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      elapsedSeconds,
      remainingSeconds: remaining,
    };
  }
  const overshoot = elapsedSeconds - targetSeconds;
  const m = Math.floor(overshoot / 60);
  const s = overshoot % 60;
  return {
    state: 'overrun',
    display: `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    elapsedSeconds,
    remainingSeconds: overshoot === 0 ? 0 : -overshoot,
  };
};

export const formatElapsedSecondary = (targetSeconds: number, elapsedSeconds: number): string => {
  if (targetSeconds <= 0) return '00:00';
  const remaining = targetSeconds - elapsedSeconds;
  if (remaining > 0) {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const overshoot = elapsedSeconds - targetSeconds;
  const m = Math.floor(overshoot / 60);
  const s = overshoot % 60;
  return `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatTarget = (targetSeconds: number): string => {
  const safe = Math.max(0, Math.floor(targetSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export interface UseRestTimerInput {
  startedAt?: number;
  targetSeconds?: number;
  enabled: boolean;
  now?: () => number;
}

export const useRestTimer = ({startedAt, targetSeconds, enabled, now}: UseRestTimerInput): RestTimerSnapshot => {
  const nowFn = now ?? Date.now;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(interval);
  }, [enabled, startedAt, targetSeconds]);

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') setTick((t) => (t + 1) % 1_000_000);
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  return useMemo(() => {
    if (!enabled || !startedAt || !targetSeconds || targetSeconds <= 0) {
      return {state: 'idle', display: '00:00', elapsedSeconds: 0, remainingSeconds: 0};
    }
    const elapsed = Math.max(0, Math.floor((nowFn() - startedAt) / 1000));
    return formatRestDisplay(targetSeconds, elapsed);
  }, [enabled, startedAt, targetSeconds, tick, nowFn]);
};

export const useVibrationOnRestEvents = (
  snapshot: RestTimerSnapshot,
  enabled: boolean,
  vibrate: (durationMs: number) => void,
) => {
  const lastEventRef = useRef<{firedAtZero: boolean; firedAt30Over: boolean; key: string}>({
    firedAtZero: false,
    firedAt30Over: false,
    key: '',
  });
  const key = `${snapshot.state}-${enabled ? 'on' : 'off'}-${snapshot.elapsedSeconds}`;
  // reset flags when timer is disabled or restarts
  useEffect(() => {
    if (!enabled) {
      lastEventRef.current = {firedAtZero: false, firedAt30Over: false, key: ''};
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const elapsed = snapshot.elapsedSeconds;
    const overshoot = -snapshot.remainingSeconds;
    if (snapshot.state === 'overrun' && overshoot === 0 && !lastEventRef.current.firedAtZero) {
      vibrate(50);
      lastEventRef.current = {...lastEventRef.current, firedAtZero: true, key};
    }
    if (snapshot.state === 'overrun' && overshoot >= 30 && !lastEventRef.current.firedAt30Over) {
      vibrate(50);
      lastEventRef.current = {...lastEventRef.current, firedAt30Over: true, key};
    }
    if (snapshot.state === 'counting' && elapsed === 0) {
      lastEventRef.current = {firedAtZero: false, firedAt30Over: false, key};
    }
  }, [snapshot.state, snapshot.elapsedSeconds, snapshot.remainingSeconds, enabled, key, vibrate]);
};
