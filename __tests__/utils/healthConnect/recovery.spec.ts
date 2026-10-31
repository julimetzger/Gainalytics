import {
  buildRecoveryDays,
  dedupeSleepSessions,
  recoveryUnavailableHint,
  serializeRecoveryDays,
  sleepPerWakeUpDay,
  stepsPerDay,
} from '../../../app/utils/healthConnect/recovery';
import {HC_PERMISSION, HealthConnectSleepSession} from '../../../app/utils/healthConnect/healthConnectNative';
import {describeHealthConnectConnection} from '../../../app/utils/healthConnect/healthConnectStatus';

// Local times, so the tests hold in every time zone the suite runs in.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const HOUR = 60 * 60 * 1000;

const night = (fromDay: number, fromHour: number, toDay: number, toHour: number, stages: HealthConnectSleepSession['stages'] = []): HealthConnectSleepSession => ({
  startMs: at(fromDay, fromHour),
  endMs: at(toDay, toHour),
  stages,
});

describe('GH-619 sleep per wake-up day', () => {
  it('assigns a night across midnight to the day it ended', () => {
    expect([...sleepPerWakeUpDay([night(13, 23, 14, 7)]).entries()]).toEqual([['2026-10-14', {sleepMs: 8 * HOUR, deepMs: 0, remMs: 0, stagedSleepMs: 0}]]);
  });

  it('subtracts awake stages and computes deep and REM only from detailed stages', () => {
    const staged = night(13, 23, 14, 7, [
      {startMs: at(13, 23), endMs: at(14, 1), stage: 'LIGHT'},
      {startMs: at(14, 1), endMs: at(14, 3), stage: 'DEEP'},
      {startMs: at(14, 3), endMs: at(14, 4), stage: 'AWAKE'},
      {startMs: at(14, 4), endMs: at(14, 6), stage: 'REM'},
      {startMs: at(14, 6), endMs: at(14, 7), stage: 'LIGHT'},
    ]);

    expect(buildRecoveryDays([staged], [], new Date(at(14, 0)), new Date(at(14, 23)))).toEqual([{date: '2026-10-14', sleep_h: 7, deep_pct: 29, rem_pct: 29}]);
  });

  it('adds a nap to the night of the same day but counts overlapping sources only once', () => {
    const watch = night(13, 23, 14, 7, [
      {startMs: at(13, 23), endMs: at(14, 1), stage: 'DEEP'},
      {startMs: at(14, 1), endMs: at(14, 7), stage: 'LIGHT'},
    ]);
    const phone = night(13, 22, 14, 8);
    const nap = night(14, 14, 14, 15);

    expect(dedupeSleepSessions([phone, nap, watch])).toEqual([watch, nap]);
    // 8 h night (from the watch, which has stages) + 1 h nap; the percentages come from the staged night.
    expect(buildRecoveryDays([phone, nap, watch], [], new Date(at(14, 0)), new Date(at(14, 23)))).toEqual([{date: '2026-10-14', sleep_h: 9, deep_pct: 25, rem_pct: 0}]);
  });
});

describe('GH-619 steps per day', () => {
  it('leaves days without steps out instead of reporting 0', () => {
    expect([...stepsPerDay([{date: '2026-10-14', steps: 20113}, {date: '2026-10-15', steps: 0}, {date: '2026-10-16', steps: Number.NaN}]).entries()]).toEqual([
      ['2026-10-14', 20113],
    ]);
  });
});

describe('GH-619 buildRecoveryDays', () => {
  it('merges sleep and steps per day, oldest first, inside the range only, and skips a day without data', () => {
    const days = buildRecoveryDays(
      [night(13, 23, 14, 6), night(15, 0, 15, 5, [{startMs: at(15, 0), endMs: at(15, 5), stage: 'SLEEPING'}]), night(9, 23, 10, 7)],
      [
        {date: '2026-10-15', steps: 4200},
        {date: '2026-10-13', steps: 20113},
        {date: '2026-10-20', steps: 999},
      ],
      new Date(at(12, 10)),
      new Date(at(16, 10)),
    );

    // 10-10 and 10-20 are outside the range; 10-12 and 10-16 have no data and are left out.
    expect(days).toEqual([
      {date: '2026-10-13', steps: 20113},
      {date: '2026-10-14', sleep_h: 7},
      {date: '2026-10-15', sleep_h: 5, steps: 4200},
    ]);
    expect(serializeRecoveryDays(days)).toBe(
      '[\n{"date":"2026-10-13","steps":20113},\n{"date":"2026-10-14","sleep_h":7},\n{"date":"2026-10-15","sleep_h":5,"steps":4200}\n]',
    );
  });

  it('rounds sleep to a tenth of an hour', () => {
    const session = {startMs: at(13, 23), endMs: at(14, 4, 20), stages: []};
    expect(buildRecoveryDays([session], [], new Date(at(14, 0)), new Date(at(14, 1)))).toEqual([{date: '2026-10-14', sleep_h: 5.3}]);
  });

  it('serializes nothing without data', () => {
    expect([buildRecoveryDays([], [], new Date(at(1, 0)), new Date(at(30, 0))), serializeRecoveryDays([])]).toEqual([[], null]);
  });
});

describe('GH-619 recoveryUnavailableHint', () => {
  const available = (granted: string[]) => ({sdkStatus: 'AVAILABLE' as const, providedBySystem: true, granted, historyReadAvailable: true});

  it('offers the switch with sleep or steps and explains every other state', () => {
    expect(
      [
        undefined,
        {sdkStatus: 'NOT_SUPPORTED' as const},
        {sdkStatus: 'UNAVAILABLE' as const, providedBySystem: false},
        {sdkStatus: 'UNAVAILABLE' as const, providedBySystem: true},
        {sdkStatus: 'PROVIDER_UPDATE_REQUIRED' as const, providedBySystem: false},
        available([]),
        available([HC_PERMISSION.READ_WEIGHT]),
        available([HC_PERMISSION.READ_SLEEP]),
        available([HC_PERMISSION.READ_STEPS]),
      ].map((status) => recoveryUnavailableHint(describeHealthConnectConnection({status, everConnected: false}))),
    ).toEqual([
      'Sleep and steps: connect Health Connect in Settings to include them.',
      'Sleep and steps: Health Connect is not available on this device.',
      'Sleep and steps: Health Connect is not installed.',
      'Sleep and steps: Health Connect is not available on this device.',
      'Sleep and steps: Health Connect needs an update.',
      'Sleep and steps: connect Health Connect in Settings to include them.',
      'Sleep and steps: allow "Read sleep" or "Read steps" in Settings → Health Connect.',
      null,
      null,
    ]);
  });
});
