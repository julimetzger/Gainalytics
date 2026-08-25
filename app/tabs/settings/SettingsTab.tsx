import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import React, {useState, useEffect} from 'react';
import {Alert, ScrollView, View, StyleSheet, Platform} from 'react-native';
import {Button, Dialog, Divider, HelperText, List, Portal, RadioButton, Switch, Text, TextInput, useTheme} from 'react-native-paper';
import ThemeColorPickerDialog from '../../components/settings/ThemeColorPickerDialog';
import {customPaletteHex, paletteLabel} from '../../theme/palette';
import {normalizeHex} from '../../theme/colorScience';
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
import {dispatchToggleMode} from '../../redux/settings/dispatch/dispatchToggleMode';
import {dispatchSetPalette} from '../../redux/settings/dispatch/dispatchSetPalette';
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

const SettingsTab = ({navigation}: Props) => {
  let settings = useSettings();
  let dispatchToggleMode1 = dispatchToggleMode();
  let toggleDisable1RMpreselect = dispatchToggleDisable1RMpreselect();
  let toggleShowTimer = dispatchToggleShowTimer();
  let toggleShowToasts = dispatchToggleShowToasts();
  let setPalette = dispatchSetPalette();
  let setExactAlarmPermission = dispatchSetExactAlarmPermission();
  let setAnthropicModelDispatch = dispatchSetAnthropicModel();
  let currentModel = useAnthropicModel();
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
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const theme = useTheme();
  const currentCustomColor = customPaletteHex(settings.palette);
  // The wheel opens on the applied custom colour, or on the current palette's
  // primary when one of the built-in palettes is active.
  const pickerStartColor =
    currentCustomColor ?? normalizeHex(theme.colors.primary) ?? '#0061A4';

  // AI Coach API key state
  const [apiKeyInput, setApiKeyInput] = useState(() => secureStorage.getAnthropicApiKey() ?? '');
  const [modelInput, setModelInput] = useState(currentModel);
  const [apiKeySecure, setApiKeySecure] = useState(true);
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [aiConfigExpanded, setAiConfigExpanded] = useState(false);
  const [chatPromptInput, setChatPromptInput] = useState(currentChatPrompt);
  const [trainingPromptInput, setTrainingPromptInput] = useState(currentTrainingPrompt);

  let fullImport = dispatchFullImport();
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
    <ScrollView>
      <View style={styles.row}>
        <Text style={{alignSelf: 'center'}}>Enable Dark Mode</Text>
        <Switch
          onValueChange={(_) => {
            dispatchToggleMode1();
          }}
          value={settings.mode === 'dark'}
        />
      </View>
      <View style={{marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <Text style={{marginRight: 10}}>Theme</Text>
        <RadioButton.Group onValueChange={(value) => setPalette(value as any)} value={settings.palette ?? 'blue'}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 10}}>
              <Text>Blue</Text>
              {/* The label next to it is decorative — only the radio itself is a
                  touch target, so e2e flows have to address these by testID. */}
              <RadioButton value="blue" testID="settings-palette-blue" />
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 10}}>
              <Text>Green</Text>
              <RadioButton value="green" testID="settings-palette-green" />
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text>Purple</Text>
              <RadioButton value="purple" testID="settings-palette-purple" />
            </View>
          </View>
        </RadioButton.Group>
      </View>
      <View style={styles.row}>
        <Text style={{alignSelf: 'center'}}>Custom colour</Text>
        <Button
          mode="outlined"
          testID="settings-custom-theme-color-button"
          // Also the value a screen reader (and the Maestro flow) reads back.
          accessibilityLabel={`Theme colour ${paletteLabel(settings.palette)}`}
          onPress={() => setColorPickerVisible(true)}
          icon={() => (
            <View
              style={[
                styles.paletteSwatch,
                {backgroundColor: theme.colors.primary, borderColor: theme.colors.outline},
              ]}
            />
          )}
        >
          {paletteLabel(settings.palette)}
        </Button>
      </View>
      <View style={styles.divider}>
        <Divider />
      </View>
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
      <View style={styles.divider}>
        <Divider />
      </View>

      {/* Exact Alarm Permission Section */}
      {Platform.OS === 'android' && Platform.Version >= 31 && (
        <>
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={{marginBottom: 4}}>Exact Alarm Permission</Text>
              <Text style={{fontSize: 12, color: 'gray'}}>{exactAlarmStatus ? 'Enabled - Notifications will be precise' : 'Disabled - Notifications may be delayed'}</Text>
            </View>
            <Switch
              value={Boolean(exactAlarmStatus)}
              onValueChange={() => handleExactAlarmSettings()}
              disabled={exactAlarmStatus === null}
            />
          </View>
          <View style={styles.divider}>
            <Divider />
          </View>
        </>
      )}

      <View style={styles.button}>
        <TimeRangePicker setPauseTimer={setPauseTimer} title={'Pause Timer: '} timeRange={settings.restTimer?.userDefaultSeconds ?? settings.localNotification?.pauseTimerInSeconds} />
        <TimeRangePicker setPauseTimer={setFinishTrainingTimer} title={'Finish Training Timer: '} timeRange={settings.localNotification?.finishTrainingTimerInSeconds} />
      </View>
      <View style={styles.divider}>
        <Divider />
      </View>
      {/* AI Configuration accordion */}
      <View style={styles.divider}>
        <Divider />
      </View>
      <List.Accordion
        title="AI Configuration"
        left={props => <List.Icon {...props} icon="cog" />}
        expanded={aiConfigExpanded}
        onPress={() => setAiConfigExpanded(v => !v)}
        testID="settings-ai-config-accordion"
      >
        <View style={{marginHorizontal: 15, marginBottom: 8}}>
          <Text variant="bodySmall" style={{color: 'gray', marginBottom: 8}}>
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
      <View style={styles.divider}>
        <Divider />
      </View>

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
          onPress={() => {
            dumbFullStateToFile();
          }}
        >
          Export Data
        </Button>
      </View>
      <View style={styles.versionFooter}>
        <Text variant="bodySmall" testID="settings-app-version">
          Version {appVersion}
        </Text>
      </View>
      <ThemeColorPickerDialog
        visible={colorPickerVisible}
        initialColor={pickerStartColor}
        onDismiss={() => setColorPickerVisible(false)}
        onConfirm={(hex) => {
          setPalette(hex);
          setColorPickerVisible(false);
        }}
      />
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
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
    marginHorizontal: 15,
  },
  divider: {
    margin: 5,
  },
  button: {
    margin: 5,
  },
  paletteSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  versionFooter: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 12,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default SettingsTab;
