import {Range} from '../../app/components/picker/date/DateRangePicker';
import {
  buildVideoAnalysisFilterSummary,
  buildVideoAnalysisRangeFromPreset,
  formatVideoAnalysisRelativeDateTime,
  formatVideoAnalysisSetIdentity,
  formatVideoAnalysisWeightLabel,
  inferVideoAnalysisMovement,
} from '../../app/utils/video-analysis-presentation';

describe('video-analysis-presentation', () => {
  it('builds the collapsed filter summary from active filters', () => {
    expect(
      buildVideoAnalysisFilterSummary({
        analysesCount: 8,
        selectedRangePreset: '3m',
        selectedExercises: [{id: 11, name: 'Bench Press'}],
        vlPresets: ['10-20%'],
        rirPresets: ['2'],
        defaultDateRange: new Range(new Date(2026, 0, 1), new Date(2026, 3, 1)),
      }),
    ).toEqual('Last 3 mo · Bench Press · 10-20% · RIR 2');
  });

  it('formats today and yesterday labels for the compact context row', () => {
    const now = new Date(2026, 3, 29, 12, 0, 0);

    expect(formatVideoAnalysisRelativeDateTime(new Date(2026, 3, 29, 8, 15, 0), now)).toEqual('Today · 08:15');
    expect(formatVideoAnalysisRelativeDateTime(new Date(2026, 3, 28, 19, 45, 0), now)).toEqual('Yesterday · 19:45');
  });

  it('builds preset date ranges and compact load labels', () => {
    const range = buildVideoAnalysisRangeFromPreset('7d', new Date(2026, 3, 29, 12, 0, 0));

    expect(range).toEqual(new Range(new Date(2026, 3, 23, 0, 0, 0, 0), new Date(2026, 3, 29, 23, 59, 59, 999)));
    expect(formatVideoAnalysisWeightLabel(165, 5)).toEqual('165 kg × 5');
  });

  it('identifies an analysis by exercise, set number, load and RIR', () => {
    expect(formatVideoAnalysisSetIdentity({exerciseName: 'Squat', setNumber: 2, weight: 155, rir: 2})).toEqual('Squat · Set 2 · 155 kg @ 2 RIR');
  });

  it('keeps a meaningful title for analyses without a linked set', () => {
    expect(formatVideoAnalysisSetIdentity({exerciseName: 'Squat'})).toEqual('Squat · No linked set');
    expect(formatVideoAnalysisSetIdentity({})).toEqual('Unlinked analysis');
    expect(formatVideoAnalysisSetIdentity({exerciseName: '  '})).toEqual('Unlinked analysis');
  });

  it('never renders undefined or NaN for partially known set data', () => {
    expect(formatVideoAnalysisSetIdentity({exerciseName: 'Squat', setNumber: 1, weight: 155})).toEqual('Squat · Set 1 · 155 kg');
    expect(formatVideoAnalysisSetIdentity({exerciseName: 'Squat', setNumber: 1, rir: 0})).toEqual('Squat · Set 1 · 0 RIR');
    expect(formatVideoAnalysisSetIdentity({setNumber: 3, weight: 100, rir: 1})).toEqual('Set 3 · 100 kg @ 1 RIR');
    expect(formatVideoAnalysisSetIdentity({exerciseName: 'Squat', setNumber: Number.NaN, weight: Number.NaN, rir: Number.NaN})).toEqual(
      'Squat · No linked set',
    );
  });

  it('maps common exercise names to placeholder movement silhouettes', () => {
    expect(inferVideoAnalysisMovement('Back Squat')).toEqual('squat');
    expect(inferVideoAnalysisMovement('Bench Press')).toEqual('bench');
    expect(inferVideoAnalysisMovement('Deadlift')).toEqual('deadlift');
    expect(inferVideoAnalysisMovement('Overhead Press')).toEqual('ohp');
    expect(inferVideoAnalysisMovement('Barbell Row')).toEqual('row');
  });
});
