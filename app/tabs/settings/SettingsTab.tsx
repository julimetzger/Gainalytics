import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React, {useState, useEffect} from "react";
import {Alert, ScrollView, View, StyleSheet, Platform} from "react-native";
import {Button, Dialog, Divider, Portal, RadioButton, Switch, Text} from "react-native-paper";
import {useSettings} from "../../redux/settings/useSettings";
import {useStore} from "react-redux";
import DocumentPicker, {DocumentPickerResponse} from 'react-native-document-picker';
import {GlobalState} from "../../redux/rootReducer";
import {dispatchFullImport} from "../../redux/fullstateactions/dispatchFullImport";
import Toast from "react-native-toast-message";
import {dispatchSetPauseTimer} from "../../redux/settings/dispatchSetPauseTimer";
import TimeRangePicker from "../../components/TimeRangePicker";
import {dispatchSetFinishTrainingTimer} from "../../redux/settings/dispatchSetFinishTrainingTimer";
import {dispatchToggleDisable1RMpreselect} from "../../redux/settings/dispatchToggleDisable1RMpreselect";
import {dispatchToggleShowTimer} from "../../redux/settings/dispatchToggleShowTimer";
import {dispatchToggleShowPlusButtonLeft} from "../../redux/settings/dispatchToggleShowPlusButtonLeft";
import {dispatchToggleMode} from "../../redux/settings/dispatchToggleMode";
import {dispatchSetPalette} from "../../redux/settings/dispatchSetPalette";
import {canScheduleExactAlarms, openExactAlarmSettings} from "../../utils/NotificationUtils";
import {dispatchSetExactAlarmPermission} from "../../redux/settings/dispatchSetExactAlarmPersmission";

const SettingsTab = ({navigation}: Props) => {
    let settings = useSettings();
    let dispatchToggleMode1 = dispatchToggleMode();
    let toggleDisable1RMpreselect = dispatchToggleDisable1RMpreselect();
    let toggleShowTimer = dispatchToggleShowTimer();
    let toggleShowPlusButtonLeft = dispatchToggleShowPlusButtonLeft();
    let setPalette = dispatchSetPalette();
    let setExactAlarmPermission = dispatchSetExactAlarmPermission();
    let store = useStore();
    const FileSaver = require('react-native-fs');

    const [importDialog, setImportDialog] = useState(false);
    const [exactAlarmStatus, setExactAlarmStatus] = useState<boolean | null>(null);

    let fullImport = dispatchFullImport();
    let setPauseTimer = dispatchSetPauseTimer();
    let setFinishTrainingTimer = dispatchSetFinishTrainingTimer();

    // Check exact alarm permission on component mount
    useEffect(() => {
        console.log("called settings callback")
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

                    if (hasPermission) {
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
            Toast.show({
                type: 'error',
                text1: 'Settings Error',
                text2: 'Could not open alarm settings',
                position: 'top',
                visibilityTime: 3000,
            });
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
        Alert.alert('Nope. This app is not using stupid measuring systems.')
    }

    function importDump(documentPickerRespons: DocumentPickerResponse) {
        FileSaver.readFile(documentPickerRespons.uri).then((res: string) => {
            let state = JSON.parse(res) as GlobalState;
            fullImport(state);
            Toast.show({
                type: 'info',
                text1: 'Import successful!',
                text2: `Data imported from ${documentPickerRespons.name}`,
                position: 'top',
                visibilityTime: 5000,
            })
        }, (err: any) => {
            Toast.show({
                type: 'error',
                text1: 'Import failed successfully!',
                text2: `Data could not be imported from ${documentPickerRespons.name}`,
                position: 'top',
                visibilityTime: 5000,
            })
        });
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
                <Switch onValueChange={(_) => { dispatchToggleMode1(); }} value={settings.mode === "dark"}/>
            </View>
            <View style={{marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <Text style={{marginRight: 10}}>Theme</Text>
                <RadioButton.Group onValueChange={(value) => setPalette(value as any)} value={settings.palette ?? 'blue'}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 10}}>
                            <Text>Blue</Text>
                            <RadioButton value="blue" />
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 10}}>
                            <Text>Green</Text>
                            <RadioButton value="green" />
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text>Purple</Text>
                            <RadioButton value="purple" />
                        </View>
                    </View>
                </RadioButton.Group>
            </View>
            <View style={styles.divider}><Divider/></View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Preselect 1RM Button</Text>
                <Switch onValueChange={(_) => { toggleDisable1RMpreselect(); }} value={!settings.toggles?.disable1RMButton}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Use Imperial Units</Text>
                <Switch onValueChange={showAlert} value={false}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Show Plus-Button on the left</Text>
                <Switch onValueChange={(_) => { toggleShowPlusButtonLeft(); }} value={!!settings.toggles?.showPlusButtonLeft}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Show Training Timer</Text>
                <Switch onValueChange={(_) => { toggleShowTimer(); }} value={!settings.toggles?.disableTimer}/>
            </View>
            <View style={styles.divider}><Divider/></View>

            {/* Exact Alarm Permission Section */}
            {Platform.OS === 'android' && Platform.Version >= 31 && (
                <>
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={{fontSize: 16, marginBottom: 4}}>Exact Alarm Permission</Text>
                            <Text style={{fontSize: 12, color: 'gray'}}>
                                {exactAlarmStatus ? 'Enabled - Notifications will be precise' : 'Disabled - Notifications may be delayed'}
                            </Text>
                        </View>
                        <Button
                            mode="outlined"
                            onPress={handleExactAlarmSettings}
                            disabled={exactAlarmStatus === null}
                        >
                            {exactAlarmStatus ? 'Enabled' : 'Enable'}
                        </Button>
                    </View>
                    <View style={styles.divider}><Divider/></View>
                </>
            )}

            <View style={styles.button}>
                <TimeRangePicker setPauseTimer={setPauseTimer}
                                 title={'Pause Timer: '}
                                 timeRange={settings.localNotification?.pauseTimerInSeconds}/>
                <TimeRangePicker setPauseTimer={setFinishTrainingTimer}
                                 title={'Finish Training Timer: '}
                                 timeRange={settings.localNotification?.finishTrainingTimerInSeconds}/>
            </View>
            <View style={styles.divider}><Divider/></View>
            <View style={{flexDirection: 'row'}}>
                <Button mode="elevated" style={{flex: 1, margin: 5}} onPress={() => {
                    setImportDialog(true)
                }}>Import Data</Button>
                <Button mode="elevated" style={{flex: 1, margin: 5}} onPress={() => {
                    dumbFullStateToFile()
                }}>Export Data</Button>
            </View>
            <Portal>
                <Dialog visible={importDialog} onDismiss={() => setImportDialog(false)}>
                    <Dialog.Title>Import full data from backup file?</Dialog.Title>
                    <Dialog.Content>
                        <Text>This action will replace all existing data in your current application with the data from the selected file. Continue?</Text>
                    </Dialog.Content>
                    <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'space-between'}}>
                        <Dialog.Actions style={{justifyContent: 'space-between'}}>
                            <Button onPress={() =>
                                setImportDialog(false)
                            }>Cancel</Button>
                            <Button onPress={() => {
                                doce();
                                setImportDialog(false)
                            }}>Import</Button>
                        </Dialog.Actions>
                    </View>
                </Dialog>
            </Portal>
        </ScrollView>
    );
}

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
    }
});

export type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default SettingsTab;
