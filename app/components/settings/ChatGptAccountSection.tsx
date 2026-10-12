import React from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import {Button, Chip, HelperText, Text, useTheme} from 'react-native-paper';
import {useChatGptModel} from '../../redux/settings/use/useChatGptModel';
import {dispatchSetChatGptModel} from '../../redux/settings/dispatch/dispatchSetChatGptModel';
import {CHATGPT_USAGE_URL} from '../../utils/ai/chatgpt/chatgptErrors';
import {useChatGptAccount} from './useChatGptAccount';

/**
 * GH-504: Settings → AI Coach with "ChatGPT (Sign in)" selected — sign in with the user's
 * ChatGPT plan, see who is connected, pick a model, sign out.
 */
const ChatGptAccountSection = () => {
  const theme = useTheme();
  const chosenModel = useChatGptModel();
  const setChatGptModel = dispatchSetChatGptModel();
  const {session, phase, message, models, modelsError, startSignIn, cancelSignIn, signOut} = useChatGptAccount();

  const busy = phase !== 'idle';
  // Without a choice, requests use the first model the plan lists.
  const selectedModel = chosenModel ?? models?.[0];

  const statusText = session
    ? `Connected as ${session.email ?? 'ChatGPT account'}`
    : phase === 'waiting'
      ? 'Waiting for sign-in in the browser…'
      : phase === 'exchanging'
        ? 'Finishing sign-in…'
        : 'Not signed in';

  return (
    <View testID="settings-chatgpt-section">
      <Text variant="bodySmall" style={[styles.intro, {color: theme.colors.onSurfaceVariant}]}>
        Uses your ChatGPT plan (Plus, Pro, …) instead of an API key. You sign in on chatgpt.com in your
        browser; the sign-in is stored encrypted on this device only.
      </Text>
      <Text variant="titleSmall" testID="settings-chatgpt-status">
        {statusText}
      </Text>

      {session ? (
        <>
          {!session.planUsage && (
            <HelperText type="error" testID="settings-chatgpt-plan-usage-missing">
              Plan usage was not allowed. Sign out and sign in again, then allow Gainalytics to use your plan.
            </HelperText>
          )}
          <Text variant="labelMedium" style={styles.modelLabel}>
            ChatGPT Model
          </Text>
          <View style={styles.chips}>
            {models?.map(slug => (
              <Chip
                key={slug}
                compact
                selected={slug === selectedModel}
                showSelectedCheck
                onPress={() => setChatGptModel(slug)}
                testID={`settings-chatgpt-model-${slug}`}
              >
                {slug}
              </Chip>
            ))}
          </View>
          {models === null && !modelsError && session.planUsage && (
            <HelperText type="info">Loading the models of your plan…</HelperText>
          )}
          {modelsError && (
            <HelperText type="error" testID="settings-chatgpt-models-error">
              {modelsError}
            </HelperText>
          )}
          <View style={styles.row}>
            <Button mode="outlined" style={styles.flex} onPress={() => Linking.openURL(CHATGPT_USAGE_URL)}>
              Usage
            </Button>
            <Button mode="outlined" style={styles.flex} onPress={signOut} testID="settings-chatgpt-signout-button">
              Sign out
            </Button>
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <Button
            mode="contained"
            icon="login"
            style={styles.flex}
            onPress={startSignIn}
            loading={busy}
            disabled={busy}
            testID="settings-chatgpt-signin-button"
          >
            Continue with ChatGPT
          </Button>
          {busy && (
            <Button mode="outlined" onPress={cancelSignIn} testID="settings-chatgpt-cancel-button">
              Cancel
            </Button>
          )}
        </View>
      )}

      {message && (
        <HelperText type={message.type} testID="settings-chatgpt-message">
          {message.text}
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  intro: {marginBottom: 8},
  modelLabel: {marginTop: 12, marginBottom: 4},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  row: {flexDirection: 'row', gap: 8, marginTop: 8},
  flex: {flex: 1},
});

export default ChatGptAccountSection;
