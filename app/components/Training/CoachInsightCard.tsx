import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {ActivityIndicator, Card, IconButton, Text, useTheme} from 'react-native-paper';
import {aiChatMarkdownStyles} from '../../tabs/Analyse/aiChatMarkdownStyles';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {GlobalState} from '../../redux/rootReducer';
import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';
import {buildRawTrainingData, buildCoachPrompt} from '../../utils/coachInsight';
import {LlmRequestOptions, LlmResult, callAnthropicClaude} from '../../utils/llmApi';
import {callChatGpt} from '../../utils/ai/chatgpt/chatgptChat';
import {useAiCredentials} from '../../utils/ai/useAiCredentials';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {useChatGptModel} from '../../redux/settings/use/useChatGptModel';
import {TRUNCATION_NOTICE} from '../../utils/ai/truncatedText';
import {insightCache, formatGeneratedAt} from '../../utils/insightCache';
import {secureStorage, subscribeToApiKeyChanges} from '../../utils/secureStorage';
import {useAnthropicModel} from '../../redux/settings/use/useAnthropicModel';
import {useAITrainingPrompt} from '../../redux/settings/use/useAITrainingPrompt';
import {startChatWithContext, setContextRange} from '../../redux/AIChat/aiChatSlice';
import {useArchiveActiveChat} from '../../redux/AIChat/use/useArchiveActiveChat';
import {serializeTrainingsForChat} from '../../utils/ai/serializeTrainingsForChat';

interface Props {
  trainings: Training[];
  /** When false, the API call is suppressed (off-screen swiper pane). Defaults to true. */
  isActive?: boolean;
}

/** Sends one insight prompt to the selected provider. */
type InsightRequester = (system: string, user: string, options: LlmRequestOptions) => Promise<LlmResult>;

type State =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'done'; text: string; generatedAt: number; truncated: boolean}
  | {status: 'no_key'}
  | {status: 'error'; message: string};

function cacheKey(trainings: Training[]): string {
  return trainings
    .filter(t => t.id !== undefined)
    .map(t => t.id!)
    .sort((a, b) => a - b)
    .join(',');
}

const CoachInsightCard = ({trainings, isActive = true}: Props) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const [state, setState] = useState<State>({status: 'idle'});
  const trainingPrompt = useAITrainingPrompt();
  const archiveActiveChat = useArchiveActiveChat();

  // Reactive API key: update when user saves / removes the key in Settings.
  const [apiKey, setApiKey] = useState<string | undefined>(() => {
    try {
      return secureStorage.getAnthropicApiKey();
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const unsub = subscribeToApiKeyChanges(() => {
      try {
        setApiKey(secureStorage.getAnthropicApiKey());
      } catch {
        setApiKey(undefined);
      }
    });
    return unsub;
  }, []);

  const model = useAnthropicModel();
  const provider = useAiProvider();
  const chatgptModel = useChatGptModel();
  const chatgptSignedIn = useAiCredentials('chatgpt');

  // GH-504: undefined when the selected provider has no credentials (card stays hidden).
  const requester = useMemo<InsightRequester | undefined>(() => {
    if (provider === 'chatgpt') {
      return chatgptSignedIn ? (system, user, options) => callChatGpt(system, user, chatgptModel, options) : undefined;
    }
    return apiKey ? (system, user, options) => callAnthropicClaude(apiKey, system, user, model, options) : undefined;
  }, [provider, chatgptSignedIn, chatgptModel, apiKey, model]);

  const workoutsById = useSelector((s: GlobalState) =>
    s.workouts.byId as Record<number, import('../../models/entities/Workout').Workout>,
  );
  const exercisesById = useSelector((s: GlobalState) =>
    s.exercises.byId as Record<number, import('../../models/entities/Exercise').Exercise>,
  );
  const videoAnalysesById = useSelector((s: GlobalState) =>
    s.videoAnalyses.byId as Record<number, import('../../models/entities/VideoAnalysis').VideoAnalysis>,
  );

  const finishedTrainings = trainings.filter(t => t.state === TrainingsState.FINISHED);
  const key = cacheKey(finishedTrainings);

  // The insight request currently in flight, so it can be cancelled or superseded.
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  // Keep stable refs to avoid stale-closure issues inside fetchInsight
  const workoutsByIdRef = useRef(workoutsById);
  const exercisesByIdRef = useRef(exercisesById);
  const videoAnalysesByIdRef = useRef(videoAnalysesById);
  workoutsByIdRef.current = workoutsById;
  exercisesByIdRef.current = exercisesById;
  videoAnalysesByIdRef.current = videoAnalysesById;

  const fetchInsight = useCallback(
    (cKey: string, currentRequester: InsightRequester | undefined, currentFinished: Training[], currentPrompt: string) => {
      if (currentFinished.length === 0) {
        setState({status: 'idle'});
        return;
      }

      const cached = cKey ? insightCache.get(cKey) : undefined;
      if (cached) {
        setState({
          status: 'done',
          text: cached.text,
          generatedAt: cached.generatedAt,
          truncated: cached.truncated === true,
        });
        return;
      }

      if (!currentRequester) {
        setState({status: 'no_key'});
        return;
      }

      setState({status: 'loading'});

      const cutoff = Date.now() - 28 * 24 * 3600 * 1000;
      const recentTrainings = currentFinished.filter(
        t => t.end && new Date(t.end).getTime() >= cutoff,
      );

      const currentTraining = [...recentTrainings]
        .filter(t => t.end != null)
        .sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime())[0];

      const coachInput = buildRawTrainingData(
        recentTrainings,
        currentTraining?.id,
        workoutsByIdRef.current,
        exercisesByIdRef.current,
        videoAnalysesByIdRef.current,
      );

      if (coachInput.sessions.length === 0) {
        setState({status: 'error', message: 'Not enough data for an insight yet.'});
        return;
      }

      const {system, user} = buildCoachPrompt(coachInput, currentPrompt);

      // GH-447: one controller per attempt. Aborting it both cancels the request that is in
      // flight and marks its response as stale, so a superseded call can never write state.
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      currentRequester(system, user, {
        signal: controller.signal,
      }).then(result => {
        if (controller.signal.aborted) return;
        requestRef.current = null;

        if (result.ok) {
          const generatedAt = Date.now();
          insightCache.set(cKey, {
            text: result.text,
            generatedAt,
            truncated: result.truncated,
          });
          setState({
            status: 'done',
            text: result.text,
            generatedAt,
            truncated: result.truncated,
          });
          return;
        }

        const err = result.error;
        if (err.type === 'no_key') {
          setState({status: 'no_key'});
        } else if (err.type === 'invalid_key') {
          setState({status: 'error', message: 'Invalid API key. Check your settings.'});
        } else if (err.type === 'rate_limit') {
          setState({status: 'error', message: 'API rate limit reached. Try again later.'});
        } else if (err.type === 'timeout') {
          // GH-447: without this the card would spin forever whenever the call never returns.
          setState({
            status: 'error',
            message: `The insight took longer than ${Math.round(err.timeoutMs / 1000)}s. Tap refresh to try again.`,
          });
        } else if (err.type === 'aborted') {
          setState({status: 'idle'});
        } else if (err.type === 'provider_error') {
          setState({status: 'error', message: err.message});
        } else if (err.type === 'network') {
          setState({status: 'error', message: `Network error: ${err.message}`});
        } else {
          setState({status: 'error', message: `API error (${err.status}): ${err.message}`});
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Number of loaded workouts / exercises: a stable scalar dep that changes when
  // Redux data arrives (initial empty state → populated), without triggering on
  // every render because the selector returns a new object reference each time.
  const workoutCount = Object.keys(workoutsById).length;
  const exerciseCount = Object.keys(exercisesById).length;

  useEffect(() => {
    if (!isActive) return;

    if (finishedTrainings.length === 0) {
      setState({status: 'idle'});
      return;
    }

    fetchInsight(key, requester, finishedTrainings, trainingPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, requester, isActive, workoutCount, exerciseCount, trainingPrompt]);

  const handleRefresh = () => {
    if (key) {
      insightCache.delete(key);
    }
    setState({status: 'loading'});
    fetchInsight(key, requester, finishedTrainings, trainingPrompt);
  };

  // Guards against a double tap archiving the running chat twice.
  const askingAIRef = useRef(false);
  const handleAskAI = async (insightText: string) => {
    if (askingAIRef.current) return;
    askingAIRef.current = true;
    try {
      await doAskAI(insightText);
    } finally {
      askingAIRef.current = false;
    }
  };

  const doAskAI = async (insightText: string) => {
    const seedContextJson = serializeTrainingsForChat(
      finishedTrainings,
      workoutsById,
      exercisesById,
      videoAnalysesById,
    );
    // GH-293: a running conversation is archived into the chat history before
    // the insight seeds a fresh one — it must never be silently overwritten.
    await archiveActiveChat();
    // Reset to 28d default so the insight-context pairing stays consistent
    const end = new Date();
    const start = new Date(end.getTime() - 28 * 24 * 3600 * 1000);
    dispatch(setContextRange({startDate: start.toISOString(), endDate: end.toISOString()}));
    dispatch(startChatWithContext({insightText, seedContextJson}));
    navigation.navigate('Analyse', {screen: 'AIChat'});
  };

  if (state.status === 'idle' || state.status === 'no_key') {
    return null;
  }

  const isLoading = state.status === 'loading';

  return (
    <Card
      style={{marginHorizontal: 8, marginTop: 4, marginBottom: 8}}
      testID="coach-insight-card"
    >
      <Card.Title
        title={<Text variant="titleSmall">Coach Insight</Text>}
        right={() => (
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <IconButton
              icon="robot"
              iconColor={theme.colors.primary}
              size={18}
            />
            {state.status === 'done' && (
              <IconButton
                icon="chat-processing-outline"
                iconColor={theme.colors.secondary}
                size={18}
                onPress={() => handleAskAI(state.text)}
                testID="coach-insight-ask-ai"
              />
            )}
            <IconButton
              icon="refresh"
              iconColor={theme.colors.onSurfaceVariant}
              size={18}
              disabled={isLoading}
              onPress={handleRefresh}
              testID="coach-insight-refresh"
            />
          </View>
        )}
      />
      <Card.Content>
        {isLoading && (
          <View
            style={{flexDirection: 'row', alignItems: 'center', gap: 8}}
            testID="coach-insight-loading"
          >
            <ActivityIndicator size="small" />
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              Generating insight…
            </Text>
          </View>
        )}
        {state.status === 'done' && (
          <>
            <Markdown
              style={aiChatMarkdownStyles(theme)}
              testID="coach-insight-text"
            >
              {state.text}
            </Markdown>
            {state.truncated && (
              <Text
                variant="bodySmall"
                style={{color: theme.colors.onSurfaceVariant, marginTop: 6, fontStyle: 'italic'}}
                testID="coach-insight-truncated"
              >
                {TRUNCATION_NOTICE}
              </Text>
            )}
            <Text
              variant="bodySmall"
              style={{color: theme.colors.onSurfaceVariant, marginTop: 6}}
              testID="coach-insight-timestamp"
            >
              {formatGeneratedAt(state.generatedAt)}
            </Text>
          </>
        )}
        {state.status === 'error' && (
          <Text
            variant="bodySmall"
            style={{color: theme.colors.error}}
            testID="coach-insight-error"
          >
            {state.message}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

export default CoachInsightCard;
