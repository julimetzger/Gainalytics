import React, {useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {GlobalState} from '../../redux/rootReducer';
import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';
import {Exercise} from '../../models/entities/Exercise';
import {VideoAnalysis} from '../../models/entities/VideoAnalysis';
import {TrainingsState} from '../../models/TrainingsState';
import {buildRawTrainingData, buildCoachPrompt} from '../../utils/coachInsight';
import {useAITrainingPrompt} from '../../redux/settings/use/useAITrainingPrompt';
import {startChatWithContext, setContextRange} from '../../redux/AIChat/aiChatSlice';
import {useArchiveActiveChat} from '../../redux/AIChat/use/useArchiveActiveChat';
import {serializeTrainingsForChat} from '../../utils/ai/serializeTrainingsForChat';
import {useCoachInsight} from './useCoachInsight';
import CoachInsightCardView from './CoachInsightCardView';

interface Props {
  trainings: Training[];
  /** When false, the API call is suppressed (off-screen swiper pane). Defaults to true. */
  isActive?: boolean;
}

const RECENT_MS = 28 * 24 * 3600 * 1000;

const cacheKey = (trainings: Training[]): string =>
  trainings
    .filter(t => t.id !== undefined)
    .map(t => t.id!)
    .sort((a, b) => a - b)
    .join(',');

/** The Coach Insight of a whole micro (Overview), built from its finished trainings of the last 4 weeks. */
const CoachInsightCard = ({trainings, isActive = true}: Props) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const trainingPrompt = useAITrainingPrompt();
  const archiveActiveChat = useArchiveActiveChat();

  const workoutsById = useSelector((s: GlobalState) => s.workouts.byId as Record<number, Workout>);
  const exercisesById = useSelector((s: GlobalState) => s.exercises.byId as Record<number, Exercise>);
  const videoAnalysesById = useSelector((s: GlobalState) => s.videoAnalyses.byId as Record<number, VideoAnalysis>);

  const finishedTrainings = trainings.filter(t => t.state === TrainingsState.FINISHED);

  const buildRequest = (prompt: string) => {
    const cutoff = Date.now() - RECENT_MS;
    const recentTrainings = finishedTrainings.filter(t => t.end && new Date(t.end).getTime() >= cutoff);
    const currentTraining = [...recentTrainings]
      .filter(t => t.end != null)
      .sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime())[0];
    const coachInput = buildRawTrainingData(recentTrainings, currentTraining?.id, workoutsById, exercisesById, videoAnalysesById);
    return coachInput.sessions.length === 0 ? undefined : buildCoachPrompt(coachInput, prompt);
  };

  // Number of loaded workouts / exercises: a stable scalar dep that changes when
  // Redux data arrives (initial empty state → populated), without triggering on
  // every render because the selector returns a new object reference each time.
  const dataVersion = `${Object.keys(workoutsById).length}:${Object.keys(exercisesById).length}`;

  const {state, provider, refresh} = useCoachInsight({
    insightKey: cacheKey(finishedTrainings),
    enabled: finishedTrainings.length > 0,
    isActive,
    prompt: trainingPrompt,
    dataVersion,
    buildRequest,
  });

  // Guards against a double tap archiving the running chat twice.
  const askingAIRef = useRef(false);
  const handleAskAI = async (insightText: string) => {
    if (askingAIRef.current) return;
    askingAIRef.current = true;
    try {
      const seedContextJson = serializeTrainingsForChat(finishedTrainings, workoutsById, exercisesById, videoAnalysesById);
      // GH-293: a running conversation is archived into the chat history before
      // the insight seeds a fresh one — it must never be silently overwritten.
      await archiveActiveChat();
      // Reset to 28d default so the insight-context pairing stays consistent
      const end = new Date();
      const start = new Date(end.getTime() - RECENT_MS);
      dispatch(setContextRange({startDate: start.toISOString(), endDate: end.toISOString()}));
      dispatch(startChatWithContext({insightText, seedContextJson}));
      navigation.navigate('Analyse', {screen: 'AIChat'});
    } finally {
      askingAIRef.current = false;
    }
  };

  return <CoachInsightCardView state={state} provider={provider} testIDPrefix="coach-insight" onRefresh={refresh} onAskAI={handleAskAI} />;
};

export default CoachInsightCard;
