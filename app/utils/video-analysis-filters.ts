import {Range} from '../components/picker/date/DateRangePicker';
import {VideoAnalysis} from '../models/entities/VideoAnalysis';

export const VL_PRESETS = ['<10%', '10-20%', '20-30%', '>30%'] as const;
export const RIR_PRESETS = ['0', '1', '2', '3', '4', '4+'] as const;

type VlPreset = (typeof VL_PRESETS)[number];
type RirPreset = (typeof RIR_PRESETS)[number];

interface VideoAnalysisFilterArgs {
  analyses: VideoAnalysis[];
  exerciseIds: number[];
  hasMuscleFilter: boolean;
  muscleExerciseIds: number[];
  dateRange: Range;
  isDateRangeFilterActive: boolean;
  vlPresets: VlPreset[];
  rirPresets: RirPreset[];
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

export function matchesVlPreset(vl: number | null, preset: VlPreset): boolean {
  if (vl === null) {
    return false;
  }

  switch (preset) {
    case '<10%':
      return vl < 10;
    case '10-20%':
      return vl >= 10 && vl < 20;
    case '20-30%':
      return vl >= 20 && vl < 30;
    case '>30%':
      return vl >= 30;
    default:
      return false;
  }
}

export function matchesRirPreset(rirStr: string | null, preset: RirPreset): boolean {
  return normalizeRirPreset(rirStr) === preset;
}

function normalizeRirPreset(rirStr: string | null): RirPreset | null {
  if (rirStr === null) {
    return null;
  }

  const trimmedValue = rirStr.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  if (trimmedValue === '4+') {
    return '4+';
  }

  const rir = Number.parseFloat(trimmedValue);
  if (Number.isNaN(rir)) {
    return null;
  }

  if (trimmedValue.includes('-')) {
    return toRirPreset(Math.trunc(rir));
  }

  if (!Number.isInteger(rir)) {
    return null;
  }

  return toRirPreset(rir);
}

function toRirPreset(rir: number): RirPreset | null {
  if (rir < 0) {
    return null;
  }

  if (rir > 4) {
    return '4+';
  }

  switch (rir) {
    case 0:
      return '0';
    case 1:
      return '1';
    case 2:
      return '2';
    case 3:
      return '3';
    case 4:
      return '4';
    default:
      return null;
  }
}

export function buildVideoAnalysisDefaultDateRange(analyses: VideoAnalysis[], now = new Date()): Range {
  if (analyses.length === 0) {
    const today = startOfDay(now);
    return new Range(today, today);
  }

  const timestamps = analyses.map((analysis) => new Date(analysis.createdAt).getTime());
  const earliestCreatedAt = new Date(Math.min(...timestamps));
  const latestCreatedAt = new Date(Math.max(...timestamps));
  return new Range(startOfDay(earliestCreatedAt), startOfDay(latestCreatedAt));
}

export function isSameRange(left: Range, right: Range): boolean {
  return startOfDay(left.startDate).getTime() === startOfDay(right.startDate).getTime() && startOfDay(left.endDate).getTime() === startOfDay(right.endDate).getTime();
}

export function filterVideoAnalyses({analyses, exerciseIds, hasMuscleFilter, muscleExerciseIds, dateRange, isDateRangeFilterActive, vlPresets, rirPresets}: VideoAnalysisFilterArgs): VideoAnalysis[] {
  const exerciseIdSet = new Set(exerciseIds);
  const muscleExerciseIdSet = new Set(muscleExerciseIds);
  const rangeStart = startOfDay(dateRange.startDate).getTime();
  const rangeEnd = endOfDay(dateRange.endDate).getTime();

  return analyses.filter((analysis) => {
    const exerciseId = analysis.exerciseId;

    if (exerciseIdSet.size > 0 && (exerciseId === undefined || !exerciseIdSet.has(exerciseId))) {
      return false;
    }

    if (hasMuscleFilter && (exerciseId === undefined || !muscleExerciseIdSet.has(exerciseId))) {
      return false;
    }

    if (isDateRangeFilterActive) {
      const createdAt = new Date(analysis.createdAt).getTime();
      if (createdAt < rangeStart || createdAt > rangeEnd) {
        return false;
      }
    }

    if (vlPresets.length > 0) {
      if (!analysis.setResult) {
        return false;
      }

      if (!vlPresets.some((preset) => matchesVlPreset(analysis.setResult?.velocityLossPercent ?? null, preset))) {
        return false;
      }
    }

    if (rirPresets.length > 0) {
      if (!analysis.setResult) {
        return false;
      }

      if (!rirPresets.some((preset) => matchesRirPreset(analysis.setResult?.rirEstimate ?? null, preset))) {
        return false;
      }
    }

    return true;
  });
}
