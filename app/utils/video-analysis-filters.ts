import {Range} from '../components/picker/date/DateRangePicker';
import {VideoAnalysis} from '../models/entities/VideoAnalysis';

export const VL_PRESETS = ['<10%', '10-20%', '20-30%', '>30%'];
export const RIR_PRESETS = ['0-1', '1-2', '2-3', '3-4', '4+'];

interface VideoAnalysisFilterArgs {
  analyses: VideoAnalysis[];
  exerciseIds: number[];
  hasMuscleFilter: boolean;
  muscleExerciseIds: number[];
  dateRange: Range;
  isDateRangeFilterActive: boolean;
  vlPresets: string[];
  rirPresets: string[];
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

export function matchesVlPreset(vl: number | null, preset: string): boolean {
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

export function matchesRirPreset(rirStr: string | null, preset: string): boolean {
  if (rirStr === null) {
    return false;
  }

  const rir = parseFloat(rirStr);
  if (Number.isNaN(rir)) {
    return false;
  }

  switch (preset) {
    case '0-1':
      return rir >= 0 && rir < 1;
    case '1-2':
      return rir >= 1 && rir < 2;
    case '2-3':
      return rir >= 2 && rir < 3;
    case '3-4':
      return rir >= 3 && rir < 4;
    case '4+':
      return rir >= 4;
    default:
      return false;
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
