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
  /** Returns the user-reported RIR from the linked workout set, or null if not found. */
  getSetRir: (workoutId: number, setIndex: number) => number | null;
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
      return vl >= 20 && vl <= 30;
    case '>30%':
      return vl > 30;
    default:
      return false;
  }
}

export function matchesRirPreset(rirStr: string | null, preset: RirPreset): boolean {
  if (rirStr === null) {
    return false;
  }

  const trimmed = rirStr.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Exact "4+" estimate only matches the "4+" chip
  if (trimmed === '4+') {
    return preset === '4+';
  }

  // Range-style estimates like "0-1", "1-2", "2-3", "3-4":
  // chip X matches if lowerBound <= X <= upperBound
  if (trimmed.includes('-')) {
    const dashIndex = trimmed.indexOf('-');
    const low = Number.parseFloat(trimmed.slice(0, dashIndex));
    const high = Number.parseFloat(trimmed.slice(dashIndex + 1));
    if (Number.isNaN(low) || Number.isNaN(high)) {
      return false;
    }

    if (preset === '4+') {
      // "4+" chip matches range estimates whose lower bound is >= 4
      return low >= 4;
    }

    const chipValue = Number.parseInt(preset, 10);
    return chipValue >= low && chipValue <= high;
  }

  // Single-value estimates (legacy data): direct comparison
  const val = Number.parseFloat(trimmed);
  if (Number.isNaN(val)) {
    return false;
  }

  if (preset === '4+') {
    return val >= 4;
  }

  if (!Number.isInteger(val)) {
    return false;
  }

  const chipValue = Number.parseInt(preset, 10);
  return val === chipValue;
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

export function filterVideoAnalyses({analyses, exerciseIds, hasMuscleFilter, muscleExerciseIds, dateRange, isDateRangeFilterActive, vlPresets, rirPresets, getSetRir}: VideoAnalysisFilterArgs): VideoAnalysis[] {
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
      const workoutId = analysis.workoutId;
      const setIndex = analysis.setIndex;
      if (workoutId === undefined || setIndex === undefined) {
        return false;
      }
      const userRir = getSetRir(workoutId, setIndex);
      if (!rirPresets.some((preset) => matchesRirPreset(userRir !== null ? String(userRir) : null, preset))) {
        return false;
      }
    }

    return true;
  });
}
