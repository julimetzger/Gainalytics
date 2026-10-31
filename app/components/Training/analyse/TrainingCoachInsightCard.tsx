import React, {useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {GlobalState} from '../../../redux/rootReducer';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Workout} from '../../../models/entities/Workout';
import {Exercise} from '../../../models/entities/Exercise';
import {VideoAnalysis} from '../../../models/entities/VideoAnalysis';
import {TrainingsState} from '../../../models/TrainingsState';
import {LastMatchingTraining} from '../../../redux/Training/use/useMuscleInvolvement';
import {buildSingleSessionData, buildSingleSessionPrompt} from '../../../utils/coachInsight';
import {useAISessionPrompt} from '../../../redux/settings/use/useAISessionPrompt';
import {setContextRange, setSelectedTrainingId, startChatWithContext} from '../../../redux/AIChat/aiChatSlice';
import {useArchiveActiveChat} from '../../../redux/AIChat/use/useArchiveActiveChat';
import {serializeTrainingsForChat} from '../../../utils/ai/serializeTrainingsForChat';
import {useCoachInsight} from '../useCoachInsight';
import CoachInsightCardView from '../CoachInsightCardView';
import {microNameFor, trainingNameFor} from './useTrainingComparison';

interface Props {
  training: Training;
  /** The last trained training at this position — the "vs last" reference. */
  previous?: LastMatchingTraining;
  trainingsPlan: TrainingsPlan;
  micro: number;
  trainingInMicro: number;
  /** When false (off-screen swiper pane), no request is made. */
  isActive: boolean;
}

const RECENT_MS = 28 * 24 * 3600 * 1000;

const loggedSets = (workoutIds: {[exerciseId: number]: number} | undefined, workoutsById: Record<number, Workout>) =>
  Object.values(workoutIds ?? {}).reduce((count, id) => count + (workoutsById[id]?.sets?.length ?? 0), 0);

/**
 * GH-645 — the Coach Insight of one training: sends only this training (plan and
 * done) and the last training at its position, with its own editable prompt.
 * Planned-only trainings show no card and make no request.
 */
const TrainingCoachInsightCard = ({training, previous, trainingsPlan, micro, trainingInMicro, isActive}: Props) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const sessionPrompt = useAISessionPrompt();
  const archiveActiveChat = useArchiveActiveChat();

  const workoutsById = useSelector((s: GlobalState) => s.workouts.byId as Record<number, Workout>);
  const exercisesById = useSelector((s: GlobalState) => s.exercises.byId as Record<number, Exercise>);
  const videoAnalysesById = useSelector((s: GlobalState) => s.videoAnalyses.byId as Record<number, VideoAnalysis>);

  const doneSets = loggedSets(training.doneWorkoutIds, workoutsById);
  const plannedSets = loggedSets(training.plannedWorkouts, workoutsById);
  const previousTraining = previous?.training;

  // Logging, editing or a new comparison training changes the key, so the cached insight never outlives its data.
  const insightKey = training.id === undefined ? '' : `training:${training.id}:${previousTraining?.id ?? '-'}:${doneSets}:${plannedSets}`;

  const trainingName = trainingNameFor(trainingsPlan, trainingInMicro);
  const buildRequest = (prompt: string) => {
    const input = buildSingleSessionData(
      training,
      `${microNameFor(trainingsPlan, micro, micro)} · ${trainingName}`,
      previous ? {training: previous.training, name: `${microNameFor(trainingsPlan, previous.micro, micro)} · ${trainingName}`} : undefined,
      workoutsById,
      exercisesById,
      videoAnalysesById,
    );
    return input ? buildSingleSessionPrompt(input, prompt) : undefined;
  };

  const {state, provider, refresh} = useCoachInsight({
    insightKey,
    enabled: training.state === TrainingsState.FINISHED || doneSets > 0,
    isActive,
    prompt: sessionPrompt,
    dataVersion: `${Object.keys(workoutsById).length}:${Object.keys(exercisesById).length}`,
    buildRequest,
  });

  // Guards against a double tap archiving the running chat twice.
  const askingAIRef = useRef(false);
  const handleAskAI = async (insightText: string) => {
    if (askingAIRef.current) return;
    askingAIRef.current = true;
    try {
      const pair = previousTraining ? [previousTraining, training] : [training];
      const seedContextJson = serializeTrainingsForChat(pair, workoutsById, exercisesById, videoAnalysesById);
      // GH-293: a running conversation is archived before the insight seeds a fresh one.
      await archiveActiveChat();
      // The chat's period must reach back to the comparison training.
      const end = new Date();
      const previousStart = previousTraining?.start ? new Date(previousTraining.start).getTime() : Infinity;
      const start = new Date(Math.min(end.getTime() - RECENT_MS, previousStart));
      dispatch(setContextRange({startDate: start.toISOString(), endDate: end.toISOString()}));
      dispatch(startChatWithContext({insightText, seedContextJson}));
      // The conversation is about this training (GH-391 subject, incl. its plan).
      if (training.id !== undefined) dispatch(setSelectedTrainingId(training.id));
      navigation.navigate('Analyse', {screen: 'AIChat'});
    } finally {
      askingAIRef.current = false;
    }
  };

  return <CoachInsightCardView state={state} provider={provider} testIDPrefix="training-coach-insight" onRefresh={refresh} onAskAI={handleAskAI} />;
};

export default TrainingCoachInsightCard;
