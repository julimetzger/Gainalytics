/**
 * GH-619: sleep and steps from Health Connect as recovery context for the AI chat.
 * Pure helpers; the raw records are only held in memory (see healthConnectReducer) and never
 * reach the store's persisted part or the export.
 */
import {getYYYYMMDDFormat} from '../DateHelper';
import {HealthConnectDailySteps, HealthConnectSleepSession, HealthConnectSleepStageType} from './healthConnectNative';
import {canReadSleep, canReadSteps, HealthConnectConnection} from './healthConnectStatus';

/** One line of the recovery context. Missing values are left out, never sent as 0. */
export interface RecoveryDay {
  /** Local date, YYYY-MM-DD; for sleep the day the night ended (wake-up day). */
  date: string;
  sleep_h?: number;
  /** Share of deep / REM sleep in percent, only when the source recorded sleep stages. */
  deep_pct?: number;
  rem_pct?: number;
  steps?: number;
}

/** Stages in which the user is not asleep; they count for the night but not for its sleep time. */
const AWAKE_STAGES: HealthConnectSleepStageType[] = ['AWAKE', 'OUT_OF_BED', 'AWAKE_IN_BED'];
/** Stages that only a tracker with real stage detection writes (not just "asleep"). */
const DETAILED_STAGES: HealthConnectSleepStageType[] = ['LIGHT', 'DEEP', 'REM'];

const durationOf = ({startMs, endMs}: {startMs: number; endMs: number}) => Math.max(0, endMs - startMs);

const hasDetailedStages = (session: HealthConnectSleepSession) => session.stages.some(stage => DETAILED_STAGES.includes(stage.stage));

/**
 * Two apps (e.g. watch and phone) often record the same night. Of every group of overlapping
 * sessions only one counts — the one with sleep stages, else the longest — so a night is never
 * counted twice. Naps that do not overlap the night are kept.
 */
export const dedupeSleepSessions = (sessions: HealthConnectSleepSession[]): HealthConnectSleepSession[] => {
  const better = (a: HealthConnectSleepSession, b: HealthConnectSleepSession) => {
    if (hasDetailedStages(a) !== hasDetailedStages(b)) return hasDetailedStages(a) ? a : b;
    return durationOf(b) > durationOf(a) ? b : a;
  };
  const sorted = [...sessions].filter(session => durationOf(session) > 0).sort((a, b) => a.startMs - b.startMs);
  const kept: HealthConnectSleepSession[] = [];
  let groupEnd = -Infinity;
  sorted.forEach(session => {
    if (kept.length > 0 && session.startMs < groupEnd) {
      kept[kept.length - 1] = better(kept[kept.length - 1], session);
      groupEnd = Math.max(groupEnd, session.endMs);
    } else {
      kept.push(session);
      groupEnd = session.endMs;
    }
  });
  return kept;
};

interface NightTotals {
  sleepMs: number;
  deepMs: number;
  remMs: number;
  /** Sleep time of the sessions that carry detailed stages (base of the percentages). */
  stagedSleepMs: number;
}

/**
 * Sleep per wake-up day: a night from 23:00 to 07:00 belongs to the day it ended. Sleep time is
 * the session minus its awake stages; several sessions of one day (night + nap) add up.
 */
export const sleepPerWakeUpDay = (sessions: HealthConnectSleepSession[]): Map<string, NightTotals> => {
  const days = new Map<string, NightTotals>();
  dedupeSleepSessions(sessions).forEach(session => {
    const awakeMs = session.stages.filter(stage => AWAKE_STAGES.includes(stage.stage)).reduce((sum, stage) => sum + durationOf(stage), 0);
    const sleepMs = Math.max(0, durationOf(session) - awakeMs);
    if (sleepMs === 0) return;
    const staged = hasDetailedStages(session);
    const stageMs = (type: HealthConnectSleepStageType) =>
      staged ? session.stages.filter(stage => stage.stage === type).reduce((sum, stage) => sum + durationOf(stage), 0) : 0;
    const date = getYYYYMMDDFormat(new Date(session.endMs));
    const day = days.get(date) ?? {sleepMs: 0, deepMs: 0, remMs: 0, stagedSleepMs: 0};
    days.set(date, {
      sleepMs: day.sleepMs + sleepMs,
      deepMs: day.deepMs + stageMs('DEEP'),
      remMs: day.remMs + stageMs('REM'),
      stagedSleepMs: day.stagedSleepMs + (staged ? sleepMs : 0),
    });
  });
  return days;
};

/** Steps per day; days without a positive total are left out (no data is not 0 steps). */
export const stepsPerDay = (steps: HealthConnectDailySteps[]): Map<string, number> => {
  const days = new Map<string, number>();
  steps.forEach(({date, steps: count}) => {
    if (Number.isFinite(count) && count > 0) days.set(date, (days.get(date) ?? 0) + Math.round(count));
  });
  return days;
};

const HOUR_MS = 60 * 60 * 1000;
const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

/**
 * The recovery days inside [start, end] (local days, both inclusive), oldest first. A day appears
 * only if it has sleep or steps; a value that is missing for that day is left out.
 */
export const buildRecoveryDays = (sleep: HealthConnectSleepSession[], steps: HealthConnectDailySteps[], start: Date, end: Date): RecoveryDay[] => {
  const firstDay = getYYYYMMDDFormat(start);
  const lastDay = getYYYYMMDDFormat(end);
  const sleepDays = sleepPerWakeUpDay(sleep);
  const stepDays = stepsPerDay(steps);
  const dates = [...new Set([...sleepDays.keys(), ...stepDays.keys()])].filter(date => date >= firstDay && date <= lastDay).sort();
  return dates.map(date => {
    const day: RecoveryDay = {date};
    const night = sleepDays.get(date);
    if (night) {
      day.sleep_h = Math.round((night.sleepMs / HOUR_MS) * 10) / 10;
      if (night.stagedSleepMs > 0) {
        day.deep_pct = percent(night.deepMs, night.stagedSleepMs);
        day.rem_pct = percent(night.remMs, night.stagedSleepMs);
      }
    }
    const daySteps = stepDays.get(date);
    if (daySteps !== undefined) day.steps = daySteps;
    return day;
  });
};

/**
 * Why the "Include sleep and steps" switch is not offered, or null when it is (at least one of
 * READ_SLEEP / READ_STEPS is granted).
 */
export const recoveryUnavailableHint = (connection: HealthConnectConnection): string | null => {
  switch (connection.kind) {
    case 'connected':
      return canReadSleep(connection) || canReadSteps(connection) ? null : 'Sleep and steps: allow "Read sleep" or "Read steps" in Settings → Health Connect.';
    case 'not_installed':
      return 'Sleep and steps: Health Connect is not installed.';
    case 'update_required':
      return 'Sleep and steps: Health Connect needs an update.';
    case 'unavailable':
    case 'not_supported':
      return 'Sleep and steps: Health Connect is not available on this device.';
    default:
      return 'Sleep and steps: connect Health Connect in Settings to include them.';
  }
};

/** Compact JSON with one line per day, or null when there is nothing to send. */
export const serializeRecoveryDays = (days: RecoveryDay[]): string | null =>
  days.length === 0 ? null : `[\n${days.map(day => JSON.stringify(day)).join(',\n')}\n]`;
