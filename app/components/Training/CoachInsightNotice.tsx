import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, IconButton, Text, useTheme} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {AiProvider} from '../../models/AiProvider';

interface Props {
  provider: AiProvider;
  testID: string;
}

export const coachInsightNoticeText = (provider: AiProvider) =>
  provider === 'chatgpt' ? 'Coach Insight – available after signing in to ChatGPT in Settings' : 'Coach Insight – available with an API key in Settings';

/**
 * GH-645 (V18): without credentials the Coach Insight no longer disappears without a
 * trace — one line that says why, linking to Settings → AI Configuration.
 */
const CoachInsightNotice = ({provider, testID}: Props) => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  // The Settings tab expands and scrolls to its AI Configuration on this param.
  const openAiSettings = () => navigation.navigate('Settings', {screen: 'Settings', params: {openAiConfig: true}});

  return (
    <Card style={styles.card} mode="outlined" onPress={openAiSettings} testID={testID}>
      <View style={styles.row}>
        <IconButton icon="robot-off-outline" iconColor={theme.colors.onSurfaceVariant} size={18} />
        <Text variant="bodySmall" style={[styles.text, {color: theme.colors.onSurfaceVariant}]} testID={`${testID}-text`}>
          {coachInsightNoticeText(provider)}
        </Text>
        <IconButton icon="chevron-right" iconColor={theme.colors.primary} size={18} onPress={openAiSettings} testID={`${testID}-link`} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
});

export default CoachInsightNotice;
