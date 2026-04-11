/**
 * Prepares training data for the AI Coach and builds the prompt.
 * Only aggregated stats are sent — no raw set-level data.
 */
import {sumBy} from 'lodash';
import {Training} from '../models/entities/Training';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {TrainingsState} from '../models/TrainingsState';
import {repetitionMax} from './AnalyseUtils';

export interface ExerciseSummary {
  exerciseName: string;
  sessions: number;
  totalVolume: number;
  oneRmEstimate: number;
  avgRir: number;
  trend: 'up' | 'down' | 'stable' | 'insufficient_data';
}

export interface CoachInsightInput {
  trainingDate: string;
  exerciseSummaries: ExerciseSummary[];
}

function calcTrend(weeklyVolumes: number[]): ExerciseSummary['trend'] {
  if (weeklyVolumes.length < 2) return 'insufficient_data';
  const first = weeklyVolumes[0];
  const last = weeklyVolumes[weeklyVolumes.length - 1];
  const delta = last - first;
  const pct = first > 0 ? delta / first : 0;
  if (pct > 0.05) return 'up';
  if (pct < -0.05) return 'down';
  return 'stable';
}

/**
 * Build per-exercise summaries from the last 4 weeks of finished trainings.
 *
 * @param recentTrainings - All FINISHED trainings from the last ~4 weeks (caller filters by date)
 * @param workoutsById    - Lookup map: workout id → Workout
 * @param exercisesById   - Lookup map: exercise id → name string
 */
export function buildExerciseSummaries(
  recentTrainings: Training[],
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, string>,
): ExerciseSummary[] {
  const finished = recentTrainings.filter(t => t.state === TrainingsState.FINISHED);

  // Group workouts by exercise
  const exerciseWorkouts = new Map<number, {workout: Workout; trainingDate: Date}[]>();

  for (const training of finished) {
    const trainingDate = training.end ? new Date(training.end) : new Date();
    for (const [exIdStr, workoutId] of Object.entries(training.doneWorkoutIds)) {
      const exerciseId = parseInt(exIdStr, 10);
      const workout = workoutsById[workoutId];
      if (!workout || !workout.sets || workout.sets.length === 0) continue;

      if (!exerciseWorkouts.has(exerciseId)) {
        exerciseWorkouts.set(exerciseId, []);
      }
      exerciseWorkouts.get(exerciseId)!.push({workout, trainingDate});
    }
  }

  const summaries: ExerciseSummary[] = [];

  exerciseWorkouts.forEach((entries, exerciseId) => {
    const exerciseName = exercisesById[exerciseId] ?? `Exercise ${exerciseId}`;

    // Sort by date ascending for trend calculation
    entries.sort((a, b) => a.trainingDate.getTime() - b.trainingDate.getTime());

    const allSets = entries.flatMap(e => e.workout.sets as WorkoutSet[]);
    const totalVolume = sumBy(allSets, s => s.weight * s.reps);
    const oneRmEstimate = Math.round(repetitionMax(...allSets) * 10) / 10;
    const avgRir = allSets.length > 0
      ? Math.round((sumBy(allSets, s => s.rir) / allSets.length) * 10) / 10
      : 0;

    // Weekly volume for trend (4 buckets by week)
    const now = Date.now();
    const weekVolumes = [0, 0, 0, 0];
    for (const {workout, trainingDate} of entries) {
      const weeksAgo = Math.floor((now - trainingDate.getTime()) / (7 * 24 * 3600 * 1000));
      const bucket = Math.min(weeksAgo, 3);
      // bucket 0 = most recent week; reverse so index 0 = oldest
      const reverseBucket = 3 - bucket;
      weekVolumes[reverseBucket] += sumBy(workout.sets as WorkoutSet[], s => s.weight * s.reps);
    }

    // Only include weeks that had data for trend calc
    const nonZeroWeeks = weekVolumes.filter(v => v > 0);

    summaries.push({
      exerciseName,
      sessions: entries.length,
      totalVolume: Math.round(totalVolume),
      oneRmEstimate,
      avgRir,
      trend: calcTrend(nonZeroWeeks),
    });
  });

  return summaries;
}

export function buildCoachPrompt(input: CoachInsightInput): {system: string; user: string} {
  const system = `You are an expert powerlifting coach. Analyse the training data and give one concise, actionable insight for the athlete. Max 3 sentences. Be direct and specific. Focus on the most important finding.`;

  const dataLines = input.exerciseSummaries.map(ex =>
    `${ex.exerciseName}: ${ex.sessions} sessions, volume ${ex.totalVolume} kg·reps, est. 1RM ${ex.oneRmEstimate} kg, avg RIR ${ex.avgRir}, trend ${ex.trend}`,
  );

  const user = `Training date: ${input.trainingDate}\n\nLast 4 weeks per exercise:\n${dataLines.join('\n')}\n\nCoach insight:`;

  return {system, user};
}
