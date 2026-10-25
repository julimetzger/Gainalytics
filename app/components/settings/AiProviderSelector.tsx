import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SegmentedButtons, Text, useTheme} from 'react-native-paper';
import {resolveAiProvider} from '../../models/AiProvider';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {dispatchSetAiProvider} from '../../redux/settings/dispatch/dispatchSetAiProvider';
import {isLoopbackAvailable} from '../../utils/ai/chatgpt/chatgptSession';

/** GH-504: who answers AI Chat and Coach Insights. Unset means Claude. */
const AiProviderSelector = () => {
  const theme = useTheme();
  const provider = useAiProvider();
  const setProvider = dispatchSetAiProvider();
  // The sign-in needs the native loopback listener, which only the Android build has (no iOS module).
  const chatGptAvailable = isLoopbackAvailable();

  const buttons = [
    {value: 'claude', label: 'Claude (API key)', testID: 'settings-ai-provider-claude'},
    {
      value: 'chatgpt',
      label: 'ChatGPT (Sign in)',
      testID: 'settings-ai-provider-chatgpt',
      disabled: !chatGptAvailable,
    },
  ];

  return (
    <View style={styles.container} testID="settings-ai-provider">
      <Text variant="labelMedium" style={styles.label}>
        AI Provider
      </Text>
      <SegmentedButtons
        value={provider}
        onValueChange={value => setProvider(resolveAiProvider(value))}
        buttons={buttons}
        density="small"
      />
      {!chatGptAvailable && (
        <Text
          variant="bodySmall"
          style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}
          testID="settings-ai-provider-chatgpt-unavailable"
        >
          Sign in with ChatGPT is only available on Android for now.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginBottom: 12},
  label: {marginBottom: 4},
  hint: {marginTop: 4},
});

export default AiProviderSelector;
