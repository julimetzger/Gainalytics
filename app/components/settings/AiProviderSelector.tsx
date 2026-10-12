import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SegmentedButtons, Text} from 'react-native-paper';
import {resolveAiProvider} from '../../models/AiProvider';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {dispatchSetAiProvider} from '../../redux/settings/dispatch/dispatchSetAiProvider';

const PROVIDER_BUTTONS = [
  {value: 'claude', label: 'Claude (API key)', testID: 'settings-ai-provider-claude'},
  {value: 'chatgpt', label: 'ChatGPT (Sign in)', testID: 'settings-ai-provider-chatgpt'},
];

/** GH-504: who answers AI Chat and Coach Insights. Unset means Claude. */
const AiProviderSelector = () => {
  const provider = useAiProvider();
  const setProvider = dispatchSetAiProvider();

  return (
    <View style={styles.container} testID="settings-ai-provider">
      <Text variant="labelMedium" style={styles.label}>
        AI Provider
      </Text>
      <SegmentedButtons
        value={provider}
        onValueChange={value => setProvider(resolveAiProvider(value))}
        buttons={PROVIDER_BUTTONS}
        density="small"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginBottom: 12},
  label: {marginBottom: 4},
});

export default AiProviderSelector;
