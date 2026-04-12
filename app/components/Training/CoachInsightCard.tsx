import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import {ActivityIndicator, Card, IconButton, Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';
import {buildRawTrainingData, buildCoachPrompt} from '../../utils/coachInsight';
import {callAnthropicClaude} from '../../utils/llmApi';
import {insightCache, formatGeneratedAt} from '../../utils/insightCache';
import {secureStorage, subscribeToApiKeyChanges} from '../../utils/secureStorage';

interface Props {
  trainings: Training[];
  /** When false, the API call is suppressed (off-screen swiper pane). Defaults to true. */
  isActive?: boolean;
}

type State =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'done'; text: string; generatedAt: number}
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
  const [state, setState] = useState<State>({status: 'idle'});

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

  // Keep a stable ref to avoid stale-closure issues inside fetchInsight
  const workoutsByIdRef = useRef(workoutsById);
  const exercisesByIdRef = useRef(exercisesById);
  const videoAnalysesByIdRef = useRef(videoAnalysesById);
  workoutsByIdRef.current = workoutsById;
  exercisesByIdRef.current = exercisesById;
  videoAnalysesByIdRef.current = videoAnalysesById;

  const fetchInsight = useCallback(
    (cKey: string, currentApiKey: string | undefined, currentFinished: Training[]) => {
      if (currentFinished.length === 0) {
        setState({status: 'idle'});
        return;
      }

      const cached = cKey ? insightCache.get(cKey) : undefined;
      if (cached) {
        setState({status: 'done', text: cached.text, generatedAt: cached.generatedAt});
        return;
      }

      if (!currentApiKey) {
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

      const {system, user} = buildCoachPrompt(coachInput);

      callAnthropicClaude(currentApiKey, system, user).then(result => {
        if (result.ok) {
          const generatedAt = Date.now();
          insightCache.set(cKey, {text: result.text, generatedAt});
          setState({status: 'done', text: result.text, generatedAt});
        } else {
          const err = result.error;
          if (err.type === 'no_key') {
            setState({status: 'no_key'});
          } else if (err.type === 'invalid_key') {
            setState({status: 'error', message: 'Invalid API key. Check your settings.'});
          } else if (err.type === 'rate_limit') {
            setState({status: 'error', message: 'API rate limit reached. Try again later.'});
          } else if (err.type === 'network') {
            setState({status: 'error', message: `Network error: ${err.message}`});
          } else {
            setState({status: 'error', message: `API error (${err.status}): ${err.message}`});
          }
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

    fetchInsight(key, apiKey, finishedTrainings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiKey, isActive, workoutCount, exerciseCount]);

  const handleRefresh = () => {
    if (key) {
      insightCache.delete(key);
    }
    setState({status: 'loading'});
    fetchInsight(key, apiKey, finishedTrainings);
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
            <Text
              variant="bodyMedium"
              testID="coach-insight-text"
            >
              {state.text}
            </Text>
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
