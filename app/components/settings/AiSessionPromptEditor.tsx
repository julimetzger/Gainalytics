import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, TextInput} from 'react-native-paper';
import Toast from 'react-native-toast-message';
import {DEFAULT_SESSION_PROMPT} from '../../constants/aiPrompts';
import {useAISessionPrompt} from '../../redux/settings/use/useAISessionPrompt';
import {useResetAISessionPrompt, useSetAISessionPrompt} from '../../redux/settings/dispatch/dispatchSetAISessionPrompt';

/** GH-645: edits the prompt of the single-training Coach Insight (Analysis tab of a training). */
const AiSessionPromptEditor = () => {
  const currentPrompt = useAISessionPrompt();
  const setPrompt = useSetAISessionPrompt();
  const resetPrompt = useResetAISessionPrompt();
  const [input, setInput] = useState(currentPrompt);

  const handleSave = () => {
    setPrompt(input);
    Toast.show({type: 'success', text1: 'Session prompt saved', position: 'top', visibilityTime: 3000});
  };

  const handleReset = () => {
    resetPrompt();
    setInput(DEFAULT_SESSION_PROMPT);
    Toast.show({type: 'info', text1: 'Session prompt reset to default', position: 'top', visibilityTime: 3000});
  };

  return (
    <View>
      <Text variant="labelMedium" style={styles.label}>AI Session Coach Prompt</Text>
      <TextInput
        mode="outlined"
        label="Single Training Coach System Prompt"
        value={input}
        onChangeText={setInput}
        multiline
        numberOfLines={5}
        testID="settings-ai-session-prompt-input"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.buttons}>
        <Button mode="outlined" onPress={handleSave} style={styles.button} testID="settings-save-session-prompt-button">
          Save
        </Button>
        <Button mode="outlined" onPress={handleReset} style={styles.button} testID="settings-reset-session-prompt-button">
          Reset to Default
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
});

export default AiSessionPromptEditor;
