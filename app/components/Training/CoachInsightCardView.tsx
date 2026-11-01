import React from 'react';
import {StyleSheet, View} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {ActivityIndicator, Card, IconButton, Text, useTheme} from 'react-native-paper';
import {aiChatMarkdownStyles} from '../../tabs/Analyse/aiChatMarkdownStyles';
import {AiProvider} from '../../models/AiProvider';
import {TRUNCATION_NOTICE} from '../../utils/ai/truncatedText';
import {formatGeneratedAt} from '../../utils/insightCache';
import {CoachInsightState} from './useCoachInsight';
import CoachInsightNotice from './CoachInsightNotice';

interface Props {
  state: CoachInsightState;
  provider: AiProvider;
  /** `coach-insight` (micro) or `training-coach-insight` (single training). */
  testIDPrefix: string;
  onRefresh: () => void;
  onAskAI: (insightText: string) => void;
}

/** The Coach Insight card: loading, the insight with "Ask again" and "continue in chat", an error, or the no-key notice. */
const CoachInsightCardView = ({state, provider, testIDPrefix, onRefresh, onAskAI}: Props) => {
  const theme = useTheme();

  if (state.status === 'idle') {
    return null;
  }
  if (state.status === 'no_key') {
    return <CoachInsightNotice provider={provider} testID={`${testIDPrefix}-notice`} />;
  }

  const isLoading = state.status === 'loading';

  return (
    <Card style={styles.card} testID={`${testIDPrefix}-card`}>
      <Card.Title
        title={<Text variant="titleSmall">Coach Insight</Text>}
        right={() => (
          <View style={styles.actions}>
            <IconButton icon="robot" iconColor={theme.colors.primary} size={18} />
            {state.status === 'done' && (
              <IconButton
                icon="chat-processing-outline"
                iconColor={theme.colors.secondary}
                size={18}
                onPress={() => onAskAI(state.text)}
                testID={`${testIDPrefix}-ask-ai`}
              />
            )}
            <IconButton
              icon="refresh"
              iconColor={theme.colors.onSurfaceVariant}
              size={18}
              disabled={isLoading}
              onPress={onRefresh}
              testID={`${testIDPrefix}-refresh`}
            />
          </View>
        )}
      />
      <Card.Content>
        {isLoading && (
          <View style={styles.loading} testID={`${testIDPrefix}-loading`}>
            <ActivityIndicator size="small" />
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              Generating insight…
            </Text>
          </View>
        )}
        {state.status === 'done' && (
          <>
            <Markdown style={aiChatMarkdownStyles(theme)} testID={`${testIDPrefix}-text`}>
              {state.text}
            </Markdown>
            {state.truncated && (
              <Text variant="bodySmall" style={[styles.meta, styles.italic, {color: theme.colors.onSurfaceVariant}]} testID={`${testIDPrefix}-truncated`}>
                {TRUNCATION_NOTICE}
              </Text>
            )}
            <Text variant="bodySmall" style={[styles.meta, {color: theme.colors.onSurfaceVariant}]} testID={`${testIDPrefix}-timestamp`}>
              {formatGeneratedAt(state.generatedAt)}
            </Text>
          </>
        )}
        {state.status === 'error' && (
          <Text variant="bodySmall" style={{color: theme.colors.error}} testID={`${testIDPrefix}-error`}>
            {state.message}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    marginTop: 6,
  },
  italic: {
    fontStyle: 'italic',
  },
});

export default CoachInsightCardView;
