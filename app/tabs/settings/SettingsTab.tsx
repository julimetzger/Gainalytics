import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/SettingsRouter';
import React, {useState, useEffect, useMemo} from 'react';
import {Alert, NativeModules, ScrollView, View, StyleSheet, Platform} from 'react-native';
import {Button, Dialog, Divider, HelperText, List, Portal, SegmentedButtons, Switch, Text, TextInput, useTheme} from 'react-native-paper';
import SettingsSection from '../../components/settings/SettingsSection';
import ThemeModeSelector from '../../components/settings/ThemeModeSelector';
import ThemeColorSelector from '../../components/settings/ThemeColorSelector';
import {secureStorage} from '../../utils/secureStorage';
import {validateAnthropicApiKey} from '../../utils/llmApi';
import {useSettings} from '../../redux/settings/use/useSettings';
import {useStore} from 'react-redux';
import DocumentPicker, {DocumentPickerResponse} from 'react-native-document-picker';
import {GlobalState} from '../../redux/rootReducer';
import {dispatchFullImport} from '../../redux/fullstateactions/dispatchFullImport';
import Toast from 'react-native-toast-message';
import {dispatchSetPauseTimer} from '../../redux/settings/dispatch/dispatchSetPauseTimer';
import TimeRangePicker from '../../components/picker/date/TimeRangePicker';
import {dispatchSetFinishTrainingTimer} from '../../redux/settings/dispatch/dispatchSetFinishTrainingTimer';
import {dispatchToggleDisable1RMpreselect} from '../../redux/settings/dispatch/dispatchToggleDisable1RMpreselect';
import {dispatchToggleShowTimer} from '../../redux/settings/dispatch/dispatchToggleShowTimer';
import {dispatchToggleShowToasts} from '../../redux/settings/dispatch/dispatchToggleShowToasts';
import {canScheduleExactAlarms, openExactAlarmSettings} from '../../utils/NotificationUtils';
import {dispatchSetExactAlarmPermission} from '../../redux/settings/dispatch/dispatchSetExactAlarmPersmission';
import {dispatchSetAnthropicModel} from '../../redux/settings/dispatch/dispatchSetAnthropicModel';
import {useAnthropicModel} from '../../redux/settings/use/useAnthropicModel';
import {DEFAULT_ANTHROPIC_MODEL} from '../../utils/llmApi';
import {dispatchSetAIChatPrompt} from '../../redux/settings/dispatch/dispatchSetAIChatPrompt';
import {dispatchResetAIChatPrompt} from '../../redux/settings/dispatch/dispatchResetAIChatPrompt';
import {dispatchSetAITrainingPrompt} from '../../redux/settings/dispatch/dispatchSetAITrainingPrompt';
import {dispatchResetAITrainingPrompt} from '../../redux/settings/dispatch/dispatchResetAITrainingPrompt';
import {useAIChatPrompt} from '../../redux/settings/use/useAIChatPrompt';
import {useAITrainingPrompt} from '../../redux/settings/use/useAITrainingPrompt';
import {DEFAULT_CHAT_PROMPT, DEFAULT_TRAINING_PROMPT} from '../../constants/aiPrompts';
import {getAppVersion} from '../../utils/appVersion';
import AiProviderSelector from '../../components/settings/AiProviderSelector';
import ChatGptAccountSection from '../../components/settings/ChatGptAccountSection';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {dispatchShowOnboarding} from '../../redux/settings/dispatch/dispatchOnboarding';
import {dispatchStrongImport} from '../../redux/fullstateactions/dispatchStrongImport';
import {buildStrongExport, countLoggedSets, strongExportFileName} from '../../utils/strongCsv/strongExport';
import {buildStrongImport, ParsedStrongFile, parseStrongCsv, StrongCsvError, WeightUnit} from '../../utils/strongCsv/strongImport';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const SettingsTab = ({navigation, route}: Props) => {
  let settings = useSettings();
  let toggleDisable1RMpreselect = dispatchToggleDisable1RMpreselect();
  let toggleShowTimer = dispatchToggleShowTimer();
  let toggleShowToasts = dispatchToggleShowToasts();
  let setExactAlarmPermission = dispatchSetExactAlarmPermission();
  let setAnthropicModelDispatch = dispatchSetAnthropicModel();
  let currentModel = useAnthropicModel();
  const aiProvider = useAiProvider();
  let store = useStore();
  let setAIChatPromptDispatch = dispatchSetAIChatPrompt();
  let resetAIChatPromptDispatch = dispatchResetAIChatPrompt();
  let setAITrainingPromptDispatch = dispatchSetAITrainingPrompt();
  let resetAITrainingPromptDispatch = dispatchResetAITrainingPrompt();
  let currentChatPrompt = useAIChatPrompt();
  let currentTrainingPrompt = useAITrainingPrompt();
  const appVersion = getAppVersion();
  const FileSaver = require('react-native-fs');

  const [importDialog, setImportDialog] = useState(false);
  const [exactAlarmStatus, setExactAlarmStatus] = useState<boolean | null>(null);

  const theme = useTheme();

  // AI Coach API key state
  const [apiKeyInput, setApiKeyInput] = useState(() => secureStorage.getAnthropicApiKey() ?? '');
  const [modelInput, setModelInput] = useState(currentModel);
  const [apiKeySecure, setApiKeySecure] = useState(true);
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [aiConfigExpanded, setAiConfigExpanded] = useState(false);
  const [chatPromptInput, setChatPromptInput] = useState(currentChatPrompt);
  const [trainingPromptInput, setTrainingPromptInput] = useState(currentTrainingPrompt);

  let fullImport = dispatchFullImport();
  const strongImport = dispatchStrongImport();

  // GH-496: Strong CSV export/import
  const [strongFile, setStrongFile] = useState<{parsed: ParsedStrongFile; fileName: string} | null>(null);
  const [assumedWeightUnit, setAssumedWeightUnit] = useState<WeightUnit>('kg');
  const [strongNotice, setStrongNotice] = useState<{title: string; text: string} | null>(null);
  const [strongExportResult, setStrongExportResult] = useState<string | null>(null);
  const strongSummary = useMemo(
    () => (strongFile ? buildStrongImport(store.getState() as GlobalState, strongFile.parsed, {assumedWeightUnit}).summary : null),
    [strongFile, assumedWeightUnit, store],
  );
  let showOnboarding = dispatchShowOnboarding();

  // GH-497: the onboarding's "Import data" lands here with the confirmation open.
  const openImportRequested = route.params?.openImport === true;
  useEffect(() => {
    if (!openImportRequested) return;
    setImportDialog(true);
    navigation.setParams({openImport: undefined});
  }, [openImportRequested, navigation]);
  let setPauseTimer = dispatchSetPauseTimer();
  let setFinishTrainingTimer = dispatchSetFinishTrainingTimer();

  // Check exact alarm permission on component mount
  useEffect(() => {
    console.log('called settings callback');
    const checkExactAlarmPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        try {
          const hasPermission = await canScheduleExactAlarms();
          setExactAlarmStatus(hasPermission);
          setExactAlarmPermission(hasPermission);
        } catch (error) {
          console.error('Error checking exact alarm permission:', error);
          setExactAlarmStatus(false);
          setExactAlarmPermission(false);
        }
      } else {
        // For Android < 12 or other platforms
        setExactAlarmStatus(true);
        setExactAlarmPermission(true);
      }
    };

    checkExactAlarmPermission();
  }, []);

  const handleExactAlarmSettings = async () => {
    try {
      await openExactAlarmSettings();
      // Re-check permission after returning from settings
      setTimeout(async () => {
        try {
          const hasPermission = await canScheduleExactAlarms();
          setExactAlarmStatus(hasPermission);
          setExactAlarmPermission(hasPermission);

          if (hasPermission && !store.getState().settings?.toggles?.disableToasts) {
            Toast.show({
              type: 'success',
              text1: 'Exact Alarm Permission Granted',
              text2: 'Notifications will now be more reliable',
              position: 'top',
              visibilityTime: 3000,
            });
          }
        } catch (error) {
          console.error('Error re-checking exact alarm permission:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error opening exact alarm settings:', error);
      if (!store.getState().settings?.toggles?.disableToasts) {
        Toast.show({
          type: 'error',
          text1: 'Settings Error',
          text2: 'Could not open alarm settings',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    }
  };

  function dumbFullStateToFile() {
    const state = store.getState();
    let number = Date.now();
    var path = FileSaver.DownloadDirectoryPath + '/' + number + '.gains';
    FileSaver.writeFile(path, JSON.stringify(state));
    Alert.alert('exported to ' + FileSaver.DownloadDirectoryPath + '/' + number + '.gains');
  }

  const handleStrongExport = async () => {
    const state = store.getState() as GlobalState;
    if (countLoggedSets(state) === 0) {
      setStrongNotice({title: 'Nothing to export', text: 'There are no logged sets yet. Finish a training first, then export it as CSV.'});
      return;
    }
    try {
      const exported = buildStrongExport(state);
      const directory = FileSaver.CachesDirectoryPath + '/exports';
      await FileSaver.mkdir(directory);
      const path = directory + '/' + strongExportFileName();
      await FileSaver.writeFile(path, exported.csv, 'utf8');
      setStrongExportResult(`Exported ${plural(exported.setCount, 'set')} from ${plural(exported.workoutCount, 'workout')}`);
      if (NativeModules.FileShare?.shareFile) {
        await NativeModules.FileShare.shareFile(path, 'text/csv', 'Export as CSV (Strong format)');
      } else {
        Alert.alert('exported to ' + path);
      }
    } catch (error: any) {
      setStrongNotice({title: 'Export failed', text: String(error?.message ?? error)});
    }
  };

  const handleStrongImportPick = async () => {
    let picked: DocumentPickerResponse;
    try {
      picked = await DocumentPicker.pickSingle({type: [DocumentPicker.types.allFiles]});
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) setStrongNotice({title: 'Import failed', text: 'The file could not be opened.'});
      return;
    }
    const fileName = picked.name ?? 'the selected file';
    try {
      const parsed = parseStrongCsv(await FileSaver.readFile(picked.uri, 'utf8'));
      setAssumedWeightUnit('kg');
      setStrongFile({parsed, fileName});
    } catch (error) {
      setStrongNotice({
        title: 'Import failed',
        text: error instanceof StrongCsvError ? `${fileName}: ${error.message} Nothing was imported.` : `${fileName} could not be read. Nothing was imported.`,
      });
    }
  };

  const confirmStrongImport = () => {
    if (!strongFile || !strongSummary) return;
    strongImport(strongFile.parsed, {assumedWeightUnit});
    setStrongFile(null);
    if (!store.getState().settings?.toggles?.disableToasts) {
      Toast.show({
        type: 'success',
        text1: 'Strong import finished',
        text2: `Plan "${strongSummary.planName}": ${plural(strongSummary.trainingCount, 'training')}, ${plural(strongSummary.setCount, 'set')}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
  };

  const showAlert = () => {
    Alert.alert('Nope. This app is not using stupid measuring systems.');
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed === '') {
      secureStorage.deleteAnthropicApiKey();
      Toast.show({type: 'info', text1: 'API key removed', position: 'top', visibilityTime: 3000});
    } else {
      secureStorage.setAnthropicApiKey(trimmed);
      Toast.show({type: 'success', text1: 'API key saved', position: 'top', visibilityTime: 3000});
    }
  };

  const handleSaveChatPrompt = () => {
    setAIChatPromptDispatch(chatPromptInput);
    Toast.show({type: 'success', text1: 'Chat prompt saved', position: 'top', visibilityTime: 3000});
  };

  const handleResetChatPrompt = () => {
    resetAIChatPromptDispatch();
    setChatPromptInput(DEFAULT_CHAT_PROMPT);
    Toast.show({type: 'info', text1: 'Chat prompt reset to default', position: 'top', visibilityTime: 3000});
  };

  const handleSaveTrainingPrompt = () => {
    setAITrainingPromptDispatch(trainingPromptInput);
    Toast.show({type: 'success', text1: 'Training prompt saved', position: 'top', visibilityTime: 3000});
  };

  const handleResetTrainingPrompt = () => {
    resetAITrainingPromptDispatch();
    setTrainingPromptInput(DEFAULT_TRAINING_PROMPT);
    Toast.show({type: 'info', text1: 'Training prompt reset to default', position: 'top', visibilityTime: 3000});
  };

  const handleSaveModel = () => {
    const trimmed = modelInput.trim();
    if (trimmed === '') {
      setModelInput(DEFAULT_ANTHROPIC_MODEL);
      setAnthropicModelDispatch('');
      Toast.show({type: 'info', text1: 'Reset to default model', position: 'top', visibilityTime: 3000});
    } else {
      setAnthropicModelDispatch(trimmed);
      Toast.show({type: 'success', text1: 'Model saved', position: 'top', visibilityTime: 3000});
    }
  };

  const handleTestApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Toast.show({type: 'error', text1: 'Enter a key first', position: 'top', visibilityTime: 3000});
      return;
    }
    setApiKeyValidating(true);
    try {
      const result = await validateAnthropicApiKey(trimmed);
      if (result.ok) {
        Toast.show({type: 'success', text1: 'API key is valid ✓', position: 'top', visibilityTime: 3000});
      } else {
        const err = result.error;
        const msg =
          err.type === 'invalid_key' ? 'Invalid API key' :
          err.type === 'rate_limit' ? 'Rate limit reached' :
          err.type === 'network' ? `Network error: ${err.message}` :
          'Validation failed';
        Toast.show({type: 'error', text1: msg, position: 'top', visibilityTime: 4000});
      }
    } finally {
      setApiKeyValidating(false);
    }
  };

  function importDump(documentPickerRespons: DocumentPickerResponse) {
    FileSaver.readFile(documentPickerRespons.uri).then(
      (res: string) => {
        let state = JSON.parse(res) as GlobalState;
        fullImport(state);
        if (!store.getState().settings?.toggles?.disableToasts) {
          Toast.show({
            type: 'info',
            text1: 'Import successful!',
            text2: `Data imported from ${documentPickerRespons.name}`,
            position: 'top',
            visibilityTime: 5000,
          });
        }
      },
      (err: any) => {
        if (!store.getState().settings?.toggles?.disableToasts) {
          Toast.show({
            type: 'error',
            text1: 'Import failed successfully!',
            text2: `Data could not be imported from ${documentPickerRespons.name}`,
            position: 'top',
            visibilityTime: 5000,
          });
        }
      },
    );
  }

  const doce = async () => {
    const res = await DocumentPicker.pickSingle({
      type: [DocumentPicker.types.allFiles],
    });
    importDump(res);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SettingsSection title="Appearance" testID="settings-section-theme">
        <ThemeModeSelector />
        <ThemeColorSelector />
      </SettingsSection>
      <SettingsSection title="General" testID="settings-section-general">
        <View style={styles.row}>
          <Text style={{alignSelf: 'center'}}>Preselect 1RM Button</Text>
          <Switch
            onValueChange={(_) => {
              toggleDisable1RMpreselect();
            }}
            value={!settings.toggles?.disable1RMButton}
          />
        </View>
        <View style={styles.row}>
          <Text style={{alignSelf: 'center'}}>Use Imperial Units</Text>
          <Switch onValueChange={showAlert} value={false} />
        </View>
        <View style={styles.row}>
          <Text style={{alignSelf: 'center'}}>Show Training Timer</Text>
          <Switch
            onValueChange={(_) => {
              toggleShowTimer();
            }}
            value={!settings.toggles?.disableTimer}
          />
        </View>
        <View style={styles.row}>
          <Text style={{alignSelf: 'center'}}>Show Toasts</Text>
          <Switch
            onValueChange={(_) => {
              toggleShowToasts();
            }}
            value={!settings.toggles?.disableToasts}
          />
        </View>
      </SettingsSection>

      <SettingsSection title="Timers & Notifications" testID="settings-section-timers">
        {/* Exact Alarm Permission */}
        {Platform.OS === 'android' && Platform.Version >= 31 && (
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={{marginBottom: 4}}>Exact Alarm Permission</Text>
              <Text style={{fontSize: 12, color: theme.colors.onSurfaceVariant}}>{exactAlarmStatus ? 'Enabled - Notifications will be precise' : 'Disabled - Notifications may be delayed'}</Text>
            </View>
            <Switch
              value={Boolean(exactAlarmStatus)}
              onValueChange={() => handleExactAlarmSettings()}
              disabled={exactAlarmStatus === null}
            />
          </View>
        )}
        <TimeRangePicker setPauseTimer={setPauseTimer} title={'Pause Timer: '} timeRange={settings.restTimer?.userDefaultSeconds ?? settings.localNotification?.pauseTimerInSeconds} />
        <TimeRangePicker setPauseTimer={setFinishTrainingTimer} title={'Finish Training Timer: '} timeRange={settings.localNotification?.finishTrainingTimerInSeconds} />
      </SettingsSection>

      <SettingsSection title="AI Coach" testID="settings-section-ai">
        <List.Accordion
          title="AI Configuration"
          left={props => <List.Icon {...props} icon="cog" />}
          expanded={aiConfigExpanded}
          onPress={() => setAiConfigExpanded(v => !v)}
          testID="settings-ai-config-accordion"
        >
          <View style={{marginBottom: 8}}>
            <AiProviderSelector />
            {aiProvider === 'chatgpt' ? (
              <ChatGptAccountSection />
            ) : (
            <>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant, marginBottom: 8}}>
              Your API key is stored encrypted on this device only. It is never sent to any server other
              than Anthropic. You need an Anthropic account to use this feature.
            </Text>
            <TextInput
              mode="outlined"
              label="Anthropic API Key"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              secureTextEntry={apiKeySecure}
              right={
                <TextInput.Icon
                  icon={apiKeySecure ? 'eye' : 'eye-off'}
                  onPress={() => setApiKeySecure(v => !v)}
                />
              }
              testID="settings-anthropic-api-key-input"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HelperText type="info">
              Get your key at console.anthropic.com
            </HelperText>
            <View style={{flexDirection: 'row', gap: 8, marginTop: 4}}>
              <Button
                mode="outlined"
                onPress={handleSaveApiKey}
                style={{flex: 1}}
                testID="settings-save-api-key-button"
              >
                Save Key
              </Button>
              <Button
                mode="contained"
                onPress={handleTestApiKey}
                loading={apiKeyValidating}
                disabled={apiKeyValidating}
                style={{flex: 1}}
                testID="settings-test-api-key-button"
              >
                Test Key
              </Button>
            </View>
            <TextInput
              mode="outlined"
              label="Claude Model"
              value={modelInput}
              onChangeText={setModelInput}
              placeholder={DEFAULT_ANTHROPIC_MODEL}
              testID="settings-anthropic-model-input"
              autoCapitalize="none"
              autoCorrect={false}
              style={{marginTop: 12}}
            />
            <HelperText type="info">
              Enter a Claude model ID (e.g. claude-haiku-4-5-20251001). Leave empty to reset to default.
            </HelperText>
            <Button
              mode="outlined"
              onPress={handleSaveModel}
              style={{marginTop: 4}}
              testID="settings-save-model-button"
            >
              Save Model
            </Button>
            </>
            )}
            <Divider style={{marginVertical: 12}} />
            <Text variant="labelMedium" style={{marginBottom: 4}}>AI Chat Prompt</Text>
            <TextInput
              mode="outlined"
              label="AI Chat System Prompt"
              value={chatPromptInput}
              onChangeText={setChatPromptInput}
              multiline
              numberOfLines={5}
              testID="settings-ai-chat-prompt-input"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
              <Button
                mode="outlined"
                onPress={handleSaveChatPrompt}
                style={{flex: 1}}
                testID="settings-save-chat-prompt-button"
              >
                Save
              </Button>
              <Button
                mode="outlined"
                onPress={handleResetChatPrompt}
                style={{flex: 1}}
                testID="settings-reset-chat-prompt-button"
              >
                Reset to Default
              </Button>
            </View>
            <Divider style={{marginVertical: 12}} />
            <Text variant="labelMedium" style={{marginBottom: 4}}>AI Training Coach Prompt</Text>
            <TextInput
              mode="outlined"
              label="Training Coach System Prompt"
              value={trainingPromptInput}
              onChangeText={setTrainingPromptInput}
              multiline
              numberOfLines={5}
              testID="settings-ai-training-prompt-input"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
              <Button
                mode="outlined"
                onPress={handleSaveTrainingPrompt}
                style={{flex: 1}}
                testID="settings-save-training-prompt-button"
              >
                Save
              </Button>
              <Button
                mode="outlined"
                onPress={handleResetTrainingPrompt}
                style={{flex: 1}}
                testID="settings-reset-training-prompt-button"
              >
                Reset to Default
              </Button>
            </View>
          </View>
        </List.Accordion>
      </SettingsSection>

      <SettingsSection title="Help" testID="settings-section-help">
        <Button mode="elevated" icon="school-outline" style={{margin: 5}} testID="settings-show-onboarding-button" onPress={showOnboarding}>
          Show Introduction
        </Button>
      </SettingsSection>

      <SettingsSection title="Data" testID="settings-section-data">
        <View style={{flexDirection: 'row'}}>
          <Button
            mode="elevated"
            style={{flex: 1, margin: 5}}
            testID="settings-import-data-button"
            onPress={() => {
              setImportDialog(true);
            }}
          >
            Import Data
          </Button>
          <Button
            mode="elevated"
            style={{flex: 1, margin: 5}}
            testID="settings-export-data-button"
            onPress={() => {
              dumbFullStateToFile();
            }}
          >
            Export Data
          </Button>
        </View>
        <Button mode="elevated" icon="file-delimited-outline" style={{margin: 5}} testID="settings-export-strong-csv-button" onPress={handleStrongExport}>
          Export as CSV (Strong format)
        </Button>
        <Button mode="elevated" icon="file-import-outline" style={{margin: 5}} testID="settings-import-strong-csv-button" onPress={handleStrongImportPick}>
          Import from Strong CSV
        </Button>
        {strongExportResult !== null && (
          <HelperText type="info" testID="settings-strong-export-result">
            {strongExportResult}
          </HelperText>
        )}
      </SettingsSection>
      <View style={styles.versionFooter}>
        <Text variant="bodySmall" testID="settings-app-version">
          Version {appVersion}
        </Text>
      </View>
      <Portal>
        <Dialog visible={importDialog} onDismiss={() => setImportDialog(false)}>
          <Dialog.Title>Import full data from backup file?</Dialog.Title>
          <Dialog.Content>
            <Text>This action will replace all existing data in your current application with the data from the selected file. Continue?</Text>
          </Dialog.Content>
          <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'space-between'}}>
            <Dialog.Actions style={{justifyContent: 'space-between'}}>
              <Button onPress={() => setImportDialog(false)}>Cancel</Button>
              <Button
                testID="settings-import-confirm-button"
                onPress={() => {
                  doce();
                  setImportDialog(false);
                }}
              >
                Import
              </Button>
            </Dialog.Actions>
          </View>
        </Dialog>
        <Dialog visible={strongFile !== null} onDismiss={() => setStrongFile(null)} testID="strong-import-summary-dialog">
          <Dialog.Title>Import from Strong CSV</Dialog.Title>
          {strongSummary && strongFile && (
            <Dialog.Content style={{gap: 6}}>
              <Text testID="strong-import-summary-file">File: {strongFile.fileName}</Text>
              {strongSummary.trainingCount === 0 ? (
                <Text testID="strong-import-summary-nothing-new">
                  Nothing new to import: all {plural(strongSummary.duplicateSessionCount, 'workout')} of this file are already in Gainalytics.
                </Text>
              ) : (
                <>
                  <Text testID="strong-import-summary-trainings">
                    {plural(strongSummary.trainingCount, 'training')} in {plural(strongSummary.weekCount, 'week')}
                  </Text>
                  <Text testID="strong-import-summary-sets">
                    {plural(strongSummary.setCount, 'set')} · {plural(strongSummary.exerciseCount, 'exercise')} ({strongSummary.newExerciseCount} new)
                  </Text>
                  <Text testID="strong-import-summary-plan">
                    New plan "{strongSummary.planName}", trainings named by {strongSummary.namedBy === 'names' ? 'workout name' : 'weekday'}: {strongSummary.trainingNames.join(', ')}
                  </Text>
                  {strongSummary.mergedSessionCount > 0 && (
                    <Text testID="strong-import-summary-merged">
                      {plural(strongSummary.mergedSessionCount, 'workout')} on the same day as another {strongSummary.mergedSessionCount === 1 ? 'was' : 'were'} combined
                    </Text>
                  )}
                  {strongSummary.duplicateSessionCount + strongSummary.skippedCardioRows + strongSummary.skippedOtherRows > 0 && (
                    <Text testID="strong-import-summary-skipped">
                      Skipped: {plural(strongSummary.duplicateSessionCount, 'already imported workout')}, {plural(strongSummary.skippedCardioRows, 'cardio row')},{' '}
                      {plural(strongSummary.skippedOtherRows, 'rest timer/note row')}
                    </Text>
                  )}
                  {strongSummary.weightUnitFromFile ? (
                    <Text testID="strong-import-summary-unit">Weights: {strongSummary.weightUnit} (from file)</Text>
                  ) : (
                    <>
                      <Text testID="strong-import-summary-unit">The file does not say the weight unit. Weights are in:</Text>
                      <SegmentedButtons
                        value={assumedWeightUnit}
                        onValueChange={(value) => setAssumedWeightUnit(value as WeightUnit)}
                        buttons={[
                          {value: 'kg', label: 'kg', testID: 'strong-import-unit-kg'},
                          {value: 'lb', label: 'lb', testID: 'strong-import-unit-lb'},
                        ]}
                      />
                    </>
                  )}
                </>
              )}
            </Dialog.Content>
          )}
          <Dialog.Actions>
            <Button onPress={() => setStrongFile(null)} testID="strong-import-cancel-button">
              {strongSummary?.trainingCount === 0 ? 'Close' : 'Cancel'}
            </Button>
            {strongSummary !== null && strongSummary.trainingCount > 0 && (
              <Button onPress={confirmStrongImport} testID="strong-import-confirm-button">
                Import
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={strongNotice !== null} onDismiss={() => setStrongNotice(null)} testID="strong-csv-notice-dialog">
          <Dialog.Title testID="strong-csv-notice-title">{strongNotice?.title}</Dialog.Title>
          <Dialog.Content>
            <Text testID="strong-csv-notice-text">{strongNotice?.text}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStrongNotice(null)} testID="strong-csv-notice-ok-button">
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 8,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  versionFooter: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 12,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default SettingsTab;
