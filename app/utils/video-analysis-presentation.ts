import {Exercise} from '../models/entities/Exercise';
import {VideoAnalysisSetResult, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {Range} from '../components/picker/date/DateRangePicker';

export type VideoAnalysisRangePreset = '7d' | '30d' | '3m' | 'all';
export type VideoAnalysisMovement = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'row' | 'default';
export type VideoAnalysisVisualStatus = 'done' | 'failed' | 'queued';

interface FilterSummaryArgs {
  analysesCount: number;
  selectedRangePreset: VideoAnalysisRangePreset;
  selectedExercises: Exercise[];
  vlPresets: string[];
  rirPresets: string[];
  defaultDateRange: Range;
  now?: Date;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function formatShortMonthDay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatShortMonthDayYear(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRangeSpan(defaultDateRange: Range, now: Date): string {
  const start = startOfDay(defaultDateRange.startDate).getTime();
  const end = endOfDay(now).getTime();
  const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));

  if (days <= 31) {
    return `Last ${days}d`;
  }

  if (days < 365) {
    return `Last ${Math.max(1, Math.round(days / 30))} mo`;
  }

  return `Last ${Math.max(1, Math.round(days / 365))} yr`;
}

export function buildVideoAnalysisRangeFromPreset(preset: VideoAnalysisRangePreset, now = new Date()): Range | null {
  if (preset === 'all') {
    return null;
  }

  const endDate = endOfDay(now);
  const startDate = startOfDay(now);

  if (preset === '7d') {
    startDate.setDate(startDate.getDate() - 6);
    return new Range(startDate, endDate);
  }

  if (preset === '30d') {
    startDate.setDate(startDate.getDate() - 29);
    return new Range(startDate, endDate);
  }

  startDate.setMonth(startDate.getMonth() - 3);
  return new Range(startDate, endDate);
}

export function formatVideoAnalysisRelativeDateTime(value: Date | string | number, now = new Date()): string {
  const date = new Date(value);
  const today = startOfDay(now);
  const subjectDay = startOfDay(date);
  const diffDays = Math.round((today.getTime() - subjectDay.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return `Today · ${formatTime(date)}`;
  }

  if (diffDays === 1) {
    return `Yesterday · ${formatTime(date)}`;
  }

  const dateLabel = date.getFullYear() === now.getFullYear() ? formatShortMonthDay(date) : formatShortMonthDayYear(date);
  return `${dateLabel} · ${formatTime(date)}`;
}

export function formatVideoAnalysisWeightLabel(weight?: number, reps?: number, includeReps = true): string {
  if (weight === undefined) {
    return includeReps && reps !== undefined ? `${reps}` : '';
  }

  if (!includeReps || reps === undefined) {
    return `${weight} kg`;
  }

  return `${weight} kg × ${reps}`;
}

export function formatVideoAnalysisMetrics(setResult?: VideoAnalysisSetResult): string | null {
  if (!setResult) {
    return null;
  }

  const parts = [
    setResult.velocityLossPercent !== null ? `VL ${setResult.velocityLossPercent.toFixed(1)}%` : null,
    setResult.rirEstimate ? `RIR ${setResult.rirEstimate}` : null,
  ].filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function getVideoAnalysisCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'lift' : 'lifts'}`;
}

export function buildVideoAnalysisFilterSummary({analysesCount, selectedRangePreset, selectedExercises, vlPresets, rirPresets, defaultDateRange, now = new Date()}: FilterSummaryArgs): string {
  const rangeSummary =
    analysesCount === 0
      ? 'No lifts'
      : selectedRangePreset === '7d'
        ? 'Last 7d'
        : selectedRangePreset === '30d'
          ? 'Last 30d'
          : selectedRangePreset === '3m'
            ? 'Last 3 mo'
            : formatRangeSpan(defaultDateRange, now);

  const exerciseSummary = selectedExercises.length === 0 ? 'all exercises' : selectedExercises.map((exercise) => exercise.name).join(', ');
  const vlSummary = vlPresets.length === 0 ? 'all VL' : vlPresets.join(', ');
  const rirSummary = rirPresets.length === 0 ? 'all RIR' : `RIR ${rirPresets.join(', ')}`;

  return [rangeSummary, exerciseSummary, vlSummary, rirSummary].join(' · ');
}

export function inferVideoAnalysisMovement(exerciseName?: string): VideoAnalysisMovement {
  const name = exerciseName?.toLowerCase() ?? '';

  if (name.includes('squat')) {
    return 'squat';
  }

  if (name.includes('bench')) {
    return 'bench';
  }

  if (name.includes('deadlift') || name.includes('rdl') || name.includes('rack pull')) {
    return 'deadlift';
  }

  if (name.includes('row')) {
    return 'row';
  }

  if (name.includes('overhead') || name.includes('ohp') || name.includes('shoulder press') || (name.includes('press') && !name.includes('bench'))) {
    return 'ohp';
  }

  return 'default';
}

export function getVideoAnalysisVisualStatus(status: VideoAnalysisStatus): VideoAnalysisVisualStatus {
  if (status === VideoAnalysisStatus.DONE) {
    return 'done';
  }

  if (status === VideoAnalysisStatus.FAILED) {
    return 'failed';
  }

  return 'queued';
}
