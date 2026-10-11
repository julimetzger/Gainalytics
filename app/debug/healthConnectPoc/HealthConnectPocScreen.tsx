/**
 * GH-502 proof of concept screen for Health Connect. Only registered when the debug-only
 * native module exists, and only reachable by long-pressing the version line in Settings.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, Divider, Text} from 'react-native-paper';
import {useStore} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {TrainingsState} from '../../models/TrainingsState';
import {Training} from '../../models/entities/Training';
import {mapTrainingToHealthConnectSession} from './healthConnectMapping';
import {
  getHealthConnectPoc,
  HealthConnectSdkStatus,
  HealthConnectSessionSummary,
  HealthConnectWeight,
} from './healthConnectPocNative';

const formatDateTime = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TEST_WEIGHT_KG = 82.5;

const shortPermission = (permission: string) => permission.replace('android.permission.health.', '');

/** The finished training with the latest end date. */
const findLastFinishedTraining = (state: GlobalState): Training | undefined =>
  Object.values(state.trainings?.byId ?? {})
    .filter(t => t.state === TrainingsState.FINISHED && t.end)
    .sort((a, b) => new Date(b.end as any).getTime() - new Date(a.end as any).getTime())[0];

const HealthConnectPocScreen = () => {
  const poc = getHealthConnectPoc();
  const store = useStore<GlobalState>();
  const [sdkStatus, setSdkStatus] = useState<HealthConnectSdkStatus | 'UNKNOWN'>('UNKNOWN');
  const [granted, setGranted] = useState<string[]>([]);
  const [weights, setWeights] = useState<HealthConnectWeight[] | null>(null);
  const [sessions, setSessions] = useState<HealthConnectSessionSummary[] | null>(null);
  const [writeResult, setWriteResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useMemo(() => {
    const state = store.getState();
    const training = findLastFinishedTraining(state);
    return training ? mapTrainingToHealthConnectSession(training, state.workouts.byId, state.exercises.byId) : null;
  }, [store]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, []);

  const refreshStatus = useCallback(
    () =>
      run(async () => {
        if (!poc) return;
        const status = await poc.getSdkStatus();
        setSdkStatus(status);
        if (status === 'AVAILABLE') setGranted(await poc.getGrantedPermissions());
      }),
    [poc, run],
  );

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  if (!poc) {
    return <Text style={styles.screen}>Health Connect PoC module not available in this build.</Text>;
  }

  const latestWeight = weights?.[0];

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="hc-poc-screen">
      <Card mode="outlined" style={styles.card}>
        <Card.Title title="Health Connect" subtitle="GH-502 proof of concept (debug builds only)" />
        <Card.Content>
          <Text testID="hc-poc-sdk-status">SDK status: {sdkStatus}</Text>
          <Text testID="hc-poc-permissions">
            Granted: {granted.length === 0 ? 'none' : granted.map(shortPermission).join(', ')}
          </Text>
          <View style={styles.buttons}>
            <Button
              mode="contained"
              testID="hc-poc-request-permissions"
              onPress={() =>
                run(async () => {
                  setGranted(await poc.requestPermissions());
                })
              }
            >
              Request permissions
            </Button>
            <Button mode="outlined" testID="hc-poc-open" onPress={() => run(async () => void (await poc.openHealthConnect()))}>
              Open Health Connect
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Title title="Body weight (read)" />
        <Card.Content>
          <Button
            mode="contained-tonal"
            testID="hc-poc-read-weight"
            onPress={() =>
              run(async () => {
                setWeights(await poc.readWeights(30));
              })
            }
          >
            Read body weight
          </Button>
          {/* Stand-in source: no external weight source could be connected on the Android 13 test device. */}
          <Button
            mode="text"
            testID="hc-poc-write-test-weight"
            onPress={() =>
              run(async () => {
                await poc.writeTestWeight(TEST_WEIGHT_KG);
                setWeights(await poc.readWeights(30));
              })
            }
          >
            Write test weight ({TEST_WEIGHT_KG.toFixed(1)} kg)
          </Button>
          {weights !== null && (
            <Text variant="titleMedium" style={styles.result} testID="hc-poc-weight">
              {latestWeight
                ? `Current body weight: ${latestWeight.kg.toFixed(1)} kg`
                : 'No body weight in Health Connect (last 30 days)'}
            </Text>
          )}
          {weights?.map(w => (
            <Text key={`${w.time}-${w.origin}`} variant="bodySmall">
              {formatDateTime(w.time)} · {w.kg.toFixed(1)} kg · {w.origin}
            </Text>
          ))}
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Title title="Last finished training (write)" />
        <Card.Content>
          {session ? (
            <>
              <Text testID="hc-poc-session-title">{session.title}</Text>
              <Text variant="bodySmall">
                {formatDateTime(session.startMs)} – {formatDateTime(session.endMs)} · {session.segments.length} segments
              </Text>
              {session.segments.map(s => (
                <Text key={s.startMs} variant="bodySmall">
                  {s.exerciseName} → {s.segmentType}, {s.repetitions} reps
                </Text>
              ))}
            </>
          ) : (
            <Text>No finished training with sets found.</Text>
          )}
          <Button
            mode="contained-tonal"
            style={styles.result}
            disabled={!session}
            testID="hc-poc-write-training"
            onPress={() =>
              run(async () => {
                if (!session) return;
                const ids = await poc.writeStrengthSession(session);
                setWriteResult(`Written to Health Connect: ${ids.length} session`);
              })
            }
          >
            Write to Health Connect
          </Button>
          {writeResult && (
            <Text style={styles.result} testID="hc-poc-write-result">
              {writeResult}
            </Text>
          )}
          <Divider style={styles.divider} />
          <Button
            mode="outlined"
            testID="hc-poc-read-sessions"
            onPress={() =>
              run(async () => {
                setSessions(await poc.readExerciseSessions(400));
              })
            }
          >
            Read exercise sessions
          </Button>
          {sessions?.length === 0 && <Text>No exercise sessions found.</Text>}
          {sessions?.map(s => (
            <Text key={`${s.startMs}-${s.origin}`} variant="bodySmall" testID="hc-poc-session-row">
              {formatDateTime(s.startMs)} · {s.title ?? '(no title)'} · {s.segmentCount} segments · {s.repetitions} reps ·{' '}
              {s.origin}
            </Text>
          ))}
        </Card.Content>
      </Card>

      {error && (
        <Text style={styles.error} testID="hc-poc-error">
          Error: {error}
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {padding: 12, paddingBottom: 32},
  card: {marginBottom: 12},
  buttons: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8},
  result: {marginTop: 8},
  divider: {marginVertical: 8},
  error: {color: 'red', marginTop: 8},
});

export default HealthConnectPocScreen;
