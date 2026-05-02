import {Range} from '../../app/components/picker/date/DateRangePicker';
import {
  buildVideoAnalysisFilterSummary,
  buildVideoAnalysisRangeFromPreset,
  formatVideoAnalysisRelativeDateTime,
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

  it('maps common exercise names to placeholder movement silhouettes', () => {
    expect(inferVideoAnalysisMovement('Back Squat')).toEqual('squat');
    expect(inferVideoAnalysisMovement('Bench Press')).toEqual('bench');
    expect(inferVideoAnalysisMovement('Deadlift')).toEqual('deadlift');
    expect(inferVideoAnalysisMovement('Overhead Press')).toEqual('ohp');
    expect(inferVideoAnalysisMovement('Barbell Row')).toEqual('row');
  });
});
