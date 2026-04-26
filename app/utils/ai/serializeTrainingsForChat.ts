import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';
import {WorkoutSet} from '../../models/entities/WorkoutSet';
import {Exercise} from '../../models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {TrainingsState} from '../../models/TrainingsState';

interface SerializedSet {
  reps: number;
  weight_kg: number;
  rir: number;
  vl_percent?: number;
}

interface SerializedExercise {
  name: string;
  sets: SerializedSet[];
}

interface SerializedSession {
  date: string;
  exercises: SerializedExercise[];
}

interface SerializedTrainingContext {
  meso_name?: string;
  micro_label?: string;
  sessions: SerializedSession[];
}

/**
 * Serialise finished trainings for AI chat context. Caller is responsible for any
 * time-window filtering — this helper serialises whatever it receives.
 * Returns null when there are no finished trainings (keeps token cost visible in logs).
 */
export function serializeTrainingsForChat(
  trainings: Training[],
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  videoAnalysesById: Record<number, VideoAnalysis>,
  currentMesoName?: string,
  currentMicroLabel?: string,
): string | null {
  const finished = trainings.filter(t => t.state === TrainingsState.FINISHED);
  if (finished.length === 0) return null;

  const vlLookup = new Map<string, number>();
  for (const analysis of Object.values(videoAnalysesById)) {
    if (
      analysis.status === VideoAnalysisStatus.DONE &&
      analysis.workoutId != null &&
      analysis.setIndex != null &&
      analysis.setResult?.velocityLossPercent != null
    ) {
      vlLookup.set(
        `${analysis.workoutId}_${analysis.setIndex}`,
        Math.round(analysis.setResult.velocityLossPercent),
      );
    }
  }

  const sorted = [...finished].sort((a, b) => {
    const ta = a.end ? new Date(a.end).getTime() : 0;
    const tb = b.end ? new Date(b.end).getTime() : 0;
    return ta - tb;
  });

  const sessions: SerializedSession[] = sorted.map(training => {
    const date = training.end
      ? new Date(training.end).toISOString().substring(0, 10)
      : 'unknown';

    const exercises: SerializedExercise[] = [];
    for (const [exIdStr, workoutId] of Object.entries(training.doneWorkoutIds)) {
      const exerciseId = parseInt(exIdStr, 10);
      const workout = workoutsById[workoutId];
      if (!workout?.sets?.length) continue;

      const exercise = exercisesById[exerciseId];
      const name = exercise?.name ?? `Exercise ${exerciseId}`;

      const sets: SerializedSet[] = (workout.sets as WorkoutSet[]).map((s, idx) => {
        const vlPct = vlLookup.get(`${workoutId}_${s.index ?? idx}`);
        const set: SerializedSet = {reps: s.reps, weight_kg: s.weight, rir: s.rir};
        if (vlPct != null) set.vl_percent = vlPct;
        return set;
      });

      exercises.push({name, sets});
    }

    return {date, exercises};
  });

  const context: SerializedTrainingContext = {sessions};
  if (currentMesoName) context.meso_name = currentMesoName;
  if (currentMicroLabel) context.micro_label = currentMicroLabel;

  return JSON.stringify(context);
}
