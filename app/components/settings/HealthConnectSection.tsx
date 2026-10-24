import React, {useCallback, useEffect} from 'react';
import {AppState, Linking, StyleSheet, View} from 'react-native';
import {Button, Switch, Text, useTheme} from 'react-native-paper';
import SettingsSection from './SettingsSection';
import {useHealthConnectActions, useHealthConnectConnection, useHealthConnectState} from '../../redux/HealthConnect/use/useHealthConnect';
import {canWriteTrainings, HEALTH_CONNECT_PERMISSION_LABELS, HealthConnectConnection} from '../../utils/healthConnect/healthConnectStatus';
import {getHealthConnect, HEALTH_CONNECT_PLAY_STORE_URL, HEALTH_CONNECT_PLAY_STORE_WEB_URL} from '../../utils/healthConnect/healthConnectNative';
import {HealthConnectSyncEvent} from '../../redux/HealthConnect/healthConnectReducer';
import {getDateStringFromDate} from '../../utils/DateHelper';

const STATUS_TEXT: Record<HealthConnectConnection['kind'], {title: string; description: string}> = {
  checking: {title: 'Checking…', description: ''},
  not_supported: {title: 'Not supported', description: ''},
  not_installed: {title: 'Not installed', description: 'On Android 13 and lower Health Connect is a separate app. Install it from the Play Store to connect Gainalytics.'},
  update_required: {title: 'Update needed', description: 'Your Health Connect app is too old. Update it in the Play Store.'},
  unavailable: {title: 'Not available', description: 'Health Connect is not available on this device.'},
  not_connected: {
    title: 'Available · not connected',
    description: 'Write finished trainings to Health Connect and show your body weight and relative strength in the analysis. Everything stays on your device.',
  },
  revoked: {title: 'Permissions revoked', description: 'Gainalytics has no Health Connect permissions anymore. Nothing is read or written until you connect again.'},
  connected: {title: 'Connected', description: ''},
};

export const describeSyncEvent = (event: HealthConnectSyncEvent) => {
  const when = getDateStringFromDate(new Date(event.at));
  if (event.kind === 'written') return `Last written ${when}: ${event.title}`;
  if (event.kind === 'deleted') return `Last removed from Health Connect ${when}`;
  return `Last attempt failed ${when}: ${event.message}`;
};

const openPlayStore = () => Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL).catch(() => Linking.openURL(HEALTH_CONNECT_PLAY_STORE_WEB_URL));

const openManagePermissions = () => {
  const hc = getHealthConnect();
  hc?.openManagePermissions().catch(() => hc.openHealthConnect());
};

/** GH-528 (T1/T2): "Health Connect" entry in Settings: status, connect, permissions and the write opt-in. */
const HealthConnectSection = () => {
  const theme = useTheme();
  const {writeEnabled, lastSync} = useHealthConnectState();
  const connection = useHealthConnectConnection();
  const {refresh, connect, setWriteEnabled} = useHealthConnectActions();

  // Re-read on open and whenever the user comes back (e.g. from Health Connect or the Play Store).
  useEffect(() => {
    refresh(true);
    const subscription = AppState.addEventListener('change', (appState) => appState === 'active' && refresh(true));
    return () => subscription.remove();
  }, [refresh]);

  const toggleWrite = useCallback(
    (enabled: boolean) => {
      setWriteEnabled(enabled);
    },
    [setWriteEnabled],
  );

  if (connection.kind === 'not_supported') return null;
  const text = STATUS_TEXT[connection.kind];
  const writePossible = canWriteTrainings(connection);

  return (
    <SettingsSection title="Health Connect" testID="settings-section-health-connect">
      <Text variant="titleMedium" testID="health-connect-status">
        {text.title}
      </Text>
      {text.description !== '' && (
        <Text variant="bodySmall" style={[styles.description, {color: theme.colors.onSurfaceVariant}]} testID="health-connect-description">
          {text.description}
        </Text>
      )}
      {connection.kind === 'connected' && (
        <Text variant="bodySmall" style={styles.description} testID="health-connect-permissions">
          Allowed: {connection.granted.map((permission) => HEALTH_CONNECT_PERMISSION_LABELS[permission]).join(', ')}
        </Text>
      )}
      {(connection.kind === 'not_installed' || connection.kind === 'update_required') && (
        <Button mode="contained-tonal" icon="google-play" style={styles.button} onPress={openPlayStore} testID="health-connect-play-store">
          {connection.kind === 'not_installed' ? 'Install from Play Store' : 'Update in Play Store'}
        </Button>
      )}
      {(connection.kind === 'not_connected' || connection.kind === 'revoked' || (connection.kind === 'connected' && connection.missing.length > 0)) && (
        <Button mode="contained" icon="heart-pulse" style={styles.button} onPress={connect} testID="health-connect-connect">
          {connection.kind === 'connected' ? 'Allow missing permissions' : connection.kind === 'revoked' ? 'Connect again' : 'Connect'}
        </Button>
      )}
      {(connection.kind === 'connected' || connection.kind === 'revoked') && (
        <Button mode="outlined" icon="shield-account-outline" style={styles.button} onPress={openManagePermissions} testID="health-connect-manage">
          Manage permissions
        </Button>
      )}
      {connection.kind !== 'checking' && (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text>Write trainings to Health Connect</Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {writePossible ? 'Finished trainings appear as strength training.' : 'Connect with "Write trainings" to turn this on.'}
            </Text>
          </View>
          {/* Can always be turned off; turning on needs the write permission. */}
          <Switch value={writeEnabled} onValueChange={toggleWrite} disabled={!writePossible && !writeEnabled} testID="health-connect-write-switch" />
        </View>
      )}
      {lastSync && writeEnabled && (
        <Text variant="bodySmall" style={[styles.description, {color: lastSync.kind === 'failed' ? theme.colors.error : theme.colors.onSurfaceVariant}]} testID="health-connect-last-sync">
          {describeSyncEvent(lastSync)}
        </Text>
      )}
    </SettingsSection>
  );
};

const styles = StyleSheet.create({
  description: {
    marginTop: 4,
  },
  button: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  rowText: {
    flex: 1,
    marginRight: 10,
  },
});

export default HealthConnectSection;
