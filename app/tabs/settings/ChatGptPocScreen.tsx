/**
 * GH-504 PoC — "Sign in with ChatGPT" developer screen.
 * Only registered in __DEV__ builds and reachable via a long-press on the version
 * footer in Settings, so normal users never see it.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {Linking, ScrollView, StyleSheet, View} from 'react-native';
import {Button, HelperText, Text, TextInput} from 'react-native-paper';
import {
  ChatGptSession,
  cancelSignIn,
  ensureFreshSession,
  isLoopbackAvailable,
  loadSession,
  signInWithChatGpt,
  signOut,
} from '../../utils/ai/chatgptPoc/chatgptSession';
import {askChatGpt, listModels} from '../../utils/ai/chatgptPoc/chatgptResponses';

const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage';
const POC_INSTRUCTIONS = 'You are a concise powerlifting coach. Answer in at most two sentences.';

type Phase = 'idle' | 'waiting' | 'exchanging' | 'connected' | 'error';

const ChatGptPocScreen = () => {
  const [session, setSession] = useState<ChatGptSession | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [detail, setDetail] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [question, setQuestion] = useState('What is a good rest time between heavy squat sets?');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      setSession(existing);
      setPhase('connected');
    }
    return () => {
      cancelSignIn();
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    setDetail('');
    setAnswer('');
    try {
      const s = await signInWithChatGpt(p => {
        if (p.step === 'listening') {
          setPhase('waiting');
          setDebugInfo(`listener 127.0.0.1:${p.port} · state=${p.state}`);
        } else if (p.step === 'exchanging') {
          setPhase('exchanging');
        }
      });
      setSession(s);
      setPhase('connected');
      setDebugInfo('');
    } catch (e: any) {
      setPhase('error');
      setDetail(`${e?.code ? `${e.code}: ` : ''}${e?.message ?? String(e)}`);
    }
  }, []);

  const handleLoadModels = useCallback(async () => {
    if (!session) return;
    try {
      const fresh = await ensureFreshSession(session);
      setSession(fresh);
      const list = (await listModels(fresh.accessToken)).map(m => m.slug);
      setModels(list);
      if (!model && list.length > 0) setModel(list[0]);
    } catch (e: any) {
      setDetail(e?.message ?? String(e));
    }
  }, [session, model]);

  const handleAsk = useCallback(async () => {
    if (!session) return;
    setAsking(true);
    setAnswer('');
    setDetail('');
    try {
      const fresh = await ensureFreshSession(session);
      setSession(fresh);
      const result = await askChatGpt(fresh.accessToken, model.trim(), POC_INSTRUCTIONS, question);
      if (result.ok) {
        setAnswer(result.text);
      } else {
        setDetail(`${result.code}: ${result.message}`);
      }
    } catch (e: any) {
      setDetail(e?.message ?? String(e));
    } finally {
      setAsking(false);
    }
  }, [session, model, question]);

  const handleSignOut = useCallback(async () => {
    const {remoteRevoked} = await signOut();
    setSession(null);
    setPhase('idle');
    setAnswer('');
    setDetail(remoteRevoked ? 'Signed out.' : 'Signed out locally — remote revocation not confirmed.');
  }, []);

  const statusText = (() => {
    switch (phase) {
      case 'waiting':
        return 'Waiting for sign-in in the browser…';
      case 'exchanging':
        return 'Exchanging authorization code…';
      case 'connected':
        return `Connected as ${session?.email ?? session?.sub ?? 'ChatGPT account'}`;
      case 'error':
        return 'Sign-in failed';
      default:
        return 'Not connected';
    }
  })();

  return (
    <ScrollView contentContainerStyle={styles.content} testID="chatgpt-poc-screen">
      <Text variant="titleMedium">Sign in with ChatGPT (PoC, GH-504)</Text>
      <Text variant="bodySmall" style={styles.muted}>
        Developer-only proof of concept. Requests use your ChatGPT plan; the Claude API key is not used here.
      </Text>

      <Text variant="bodyLarge" style={styles.status} testID="chatgpt-poc-status">
        {statusText}
      </Text>
      {session && phase === 'connected' ? (
        <Text variant="bodySmall" testID="chatgpt-poc-plan-usage">
          {session.planUsage ? 'Using ChatGPT plan' : 'Plan usage not granted (scope chatgpt.tokens.use.direct missing)'}
        </Text>
      ) : null}
      {!isLoopbackAvailable() ? (
        <HelperText type="error">Native loopback module missing — rebuild the APK.</HelperText>
      ) : null}

      {phase !== 'connected' ? (
        <Button
          mode="contained"
          icon="login"
          style={styles.button}
          onPress={handleSignIn}
          disabled={phase === 'waiting' || phase === 'exchanging'}
          testID="chatgpt-poc-signin-button"
        >
          Continue with ChatGPT
        </Button>
      ) : (
        <View>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label="Model"
              value={model}
              onChangeText={setModel}
              style={styles.flex}
              testID="chatgpt-poc-model-input"
            />
            <Button onPress={handleLoadModels} testID="chatgpt-poc-load-models-button">
              Load models
            </Button>
          </View>
          {models.length > 0 ? (
            <Text variant="bodySmall" style={styles.muted}>
              Available: {models.join(', ')}
            </Text>
          ) : null}
          <TextInput
            mode="outlined"
            label="Test question"
            value={question}
            onChangeText={setQuestion}
            multiline
            style={styles.button}
            testID="chatgpt-poc-question-input"
          />
          <Button
            mode="contained"
            style={styles.button}
            onPress={handleAsk}
            loading={asking}
            disabled={asking || !model.trim()}
            testID="chatgpt-poc-ask-button"
          >
            Ask ChatGPT
          </Button>
          {answer ? (
            <Text variant="bodyMedium" style={styles.answer} testID="chatgpt-poc-answer">
              {answer}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Button onPress={() => Linking.openURL(MANAGE_USAGE_URL)}>Manage usage</Button>
            {/* Re-runs the browser flow without signing out; the stored session is only replaced on success. */}
            <Button onPress={handleSignIn} testID="chatgpt-poc-reconnect-button">
              Reconnect
            </Button>
            <Button onPress={handleSignOut} testID="chatgpt-poc-signout-button">
              Sign out
            </Button>
          </View>
        </View>
      )}

      {detail ? (
        <Text variant="bodySmall" style={styles.detail} testID="chatgpt-poc-detail">
          {detail}
        </Text>
      ) : null}
      {debugInfo ? (
        <Text variant="bodySmall" style={styles.muted} testID="chatgpt-poc-debug">
          {debugInfo}
        </Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {padding: 16, gap: 8},
  muted: {opacity: 0.7},
  status: {marginTop: 12, fontWeight: 'bold'},
  button: {marginTop: 8},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8},
  flex: {flex: 1},
  answer: {marginTop: 12},
  detail: {marginTop: 12, color: '#b3261e'},
});

export default ChatGptPocScreen;
