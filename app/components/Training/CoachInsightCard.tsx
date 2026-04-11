import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import {ActivityIndicator, Card, IconButton, Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';
import {buildRawTrainingData, buildCoachPrompt} from '../../utils/coachInsight';
import {callAnthropicClaude} from '../../utils/llmApi';
import {insightCache} from '../../utils/insightCache';
import {secureStorage} from '../../utils/secureStorage';

interface Props {
  trainings: Training[];
}

type State =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'done'; text: string}
  | {status: 'no_key'}
  | {status: 'error'; message: string};

function cacheKey(trainings: Training[]): string {
  return trainings
    .filter(t => t.id !== undefined)
    .map(t => t.id!)
    .sort((a, b) => a - b)
    .join(',');
}

const CoachInsightCard = ({trainings}: Props) => {
  const theme = useTheme();
  const [state, setState] = useState<State>({status: 'idle'});

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

  useEffect(() => {
    if (finishedTrainings.length === 0) return;

    const cached = key ? insightCache.get(key) : undefined;
    if (cached) {
      setState({status: 'done', text: cached});
      return;
    }

    const apiKey = secureStorage.getAnthropicApiKey();
    if (!apiKey) {
      setState({status: 'no_key'});
      return;
    }

    setState({status: 'loading'});

    // Last 4 weeks: filter trainings whose end date is within 28 days
    const cutoff = Date.now() - 28 * 24 * 3600 * 1000;
    const recentTrainings = finishedTrainings.filter(
      t => t.end && new Date(t.end).getTime() >= cutoff,
    );

    // Current training = the most recently finished one (highest end timestamp)
    const currentTraining = [...recentTrainings]
      .filter(t => t.end != null)
      .sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime())[0];

    const coachInput = buildRawTrainingData(
      recentTrainings,
      currentTraining?.id,
      workoutsById,
      exercisesById,
      videoAnalysesById,
    );

    if (coachInput.sessions.length === 0) {
      setState({status: 'error', message: 'Not enough data for an insight yet.'});
      return;
    }

    const {system, user} = buildCoachPrompt(coachInput);

    callAnthropicClaude(apiKey, system, user).then(result => {
      if (result.ok) {
        insightCache.set(key, result.text);
        setState({status: 'done', text: result.text});
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
  }, [key]);

  if (state.status === 'idle' || state.status === 'no_key') {
    return null;
  }

  return (
    <Card
      style={{marginHorizontal: 8, marginTop: 4, marginBottom: 8}}
      testID="coach-insight-card"
    >
      <Card.Title
        title={<Text variant="titleSmall">Coach Insight</Text>}
        right={() => (
          <IconButton
            icon="robot"
            iconColor={theme.colors.primary}
            size={18}
          />
        )}
      />
      <Card.Content>
        {state.status === 'loading' && (
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
          <Text
            variant="bodyMedium"
            testID="coach-insight-text"
          >
            {state.text}
          </Text>
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
