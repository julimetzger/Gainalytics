import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {vlToRirEstimate} from '../../utils/velocityLossRir';
import {MicroVLDataPoint} from './VelocityLossInsightCard';

export interface VLInsightData {
  exerciseId: number;
  exerciseName: string;
  heaviestWeightKg: number;
  currentVlPercent: number;
  vlRirEstimate: string;
  reportedRir: number;
  microHistory: MicroVLDataPoint[];
}

/**
 * Derives VL Insight Card data for up to 3 exercises in the given micro.
 * Only exercises that have a linked (done) video analysis are included.
 */
export function useVelocityLossInsights(trainingsPlan: TrainingsPlan, currentMicro: number): VLInsightData[] {
  const videoAnalyses = useSelector((state: GlobalState) => state.videoAnalyses);
  const trainings = useSelector((state: GlobalState) => state.trainings);
  const workouts = useSelector((state: GlobalState) => state.workouts);
  const exercises = useSelector((state: GlobalState) => state.exercises);

  return useMemo(() => {
    // Build a lookup: workoutId → micro for all trainings in this plan
    const workoutIdToMicro = new Map<number, number>();
    for (const [key, trainingId] of Object.entries(trainingsPlan.trainings)) {
      const micro = parseInt(key.split(',')[0], 10);
      const training = trainings.byId[trainingId];
      if (!training) continue;
      for (const workoutId of Object.values(training.doneWorkoutIds)) {
        workoutIdToMicro.set(workoutId, micro);
      }
    }

    // Get all DONE analyses with velocity loss data that are linked to this plan
    const linkedAnalyses = videoAnalyses.allIds
      .map((id) => videoAnalyses.byId[id])
      .filter(
        (a) =>
          a !== undefined &&
          a.status === VideoAnalysisStatus.DONE &&
          a.workoutId !== undefined &&
          a.exerciseId !== undefined &&
          a.setResult?.velocityLossPercent != null &&
          workoutIdToMicro.has(a.workoutId!),
      );

    // Group analyses by exerciseId, keeping only those in the current micro for the "current" data
    const currentMicroAnalysesByExercise = new Map<number, typeof linkedAnalyses[0][]>();
    for (const a of linkedAnalyses) {
      const micro = workoutIdToMicro.get(a.workoutId!);
      if (micro !== currentMicro) continue;
      const existing = currentMicroAnalysesByExercise.get(a.exerciseId!) ?? [];
      existing.push(a);
      currentMicroAnalysesByExercise.set(a.exerciseId!, existing);
    }

    if (currentMicroAnalysesByExercise.size === 0) return [];

    // For each exercise, find the analysis linked to the heaviest set in current micro
    const insights: VLInsightData[] = [];

    for (const [exerciseId, analyses] of currentMicroAnalysesByExercise) {
      if (insights.length >= 3) break;

      const exercise = exercises.byId[exerciseId];
      if (!exercise) continue;

      // Find the analysis linked to the heaviest *analyzed* set (using setIndex)
      let bestAnalysis = analyses[0];
      let bestWeight = 0;

      for (const a of analyses) {
        const workout = a.workoutId !== undefined ? workouts.byId[a.workoutId] : undefined;
        if (!workout) continue;
        const setWeight =
          a.setIndex !== undefined ? (workout.sets.find(s => s.index === a.setIndex)?.weight ?? 0) : Math.max(...workout.sets.map((s) => s.weight ?? 0));
        if (setWeight > bestWeight) {
          bestWeight = setWeight;
          bestAnalysis = a;
        }
      }

      const workout = bestAnalysis?.workoutId !== undefined ? workouts.byId[bestAnalysis.workoutId] : undefined;
      if (!workout) continue;

      // Use the actual analyzed set's weight (via setIndex)
      const analyzedSetWeight =
        bestAnalysis!.setIndex !== undefined
          ? (workout.sets.find(s => s.index === bestAnalysis!.setIndex)?.weight ?? bestWeight)
          : bestWeight;
      const analyzedSet =
        bestAnalysis!.setIndex !== undefined ? workout.sets.find(s => s.index === bestAnalysis!.setIndex) : undefined;
      const reportedRir = analyzedSet?.rir ?? 0;
      const currentVlPercent = bestAnalysis!.setResult!.velocityLossPercent!;

      // Build sparkline: one VL% point per micro for this exercise (heaviest *analyzed* set wins)
      const microHistoryMap = new Map<number, {vlPercent: number; weight: number}>();
      for (const a of linkedAnalyses) {
        if (a.exerciseId !== exerciseId) continue;
        const micro = workoutIdToMicro.get(a.workoutId!);
        if (micro === undefined) continue;
        const vl = a.setResult?.velocityLossPercent;
        if (vl == null) continue;
        const aWorkout = a.workoutId !== undefined ? workouts.byId[a.workoutId] : undefined;
        if (!aWorkout) continue;
        // Use setIndex to get the analyzed set's weight (same logic as insight selection)
        const w =
          a.setIndex !== undefined
            ? (aWorkout.sets.find(s => s.index === a.setIndex)?.weight ?? 0)
            : Math.max(...aWorkout.sets.map((s) => s.weight ?? 0));
        const prev = microHistoryMap.get(micro);
        if (prev === undefined || w > prev.weight) {
          microHistoryMap.set(micro, {vlPercent: vl, weight: w});
        }
      }

      const microHistory: MicroVLDataPoint[] = Array.from(microHistoryMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([micro, {vlPercent}]) => ({micro, vlPercent}));

      insights.push({
        exerciseId,
        exerciseName: exercise.name,
        heaviestWeightKg: analyzedSetWeight,
        currentVlPercent,
        vlRirEstimate: vlToRirEstimate(currentVlPercent),
        reportedRir,
        microHistory,
      });
    }

    return insights;
  }, [videoAnalyses, trainings, workouts, exercises, trainingsPlan, currentMicro]);
}
