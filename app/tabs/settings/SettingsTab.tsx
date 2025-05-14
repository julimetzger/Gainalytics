import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React, {useState} from "react";
import {Alert, ScrollView, View, StyleSheet} from "react-native";
import {Button, Dialog, Divider, Portal, Switch, Text} from "react-native-paper";
import {dispatchtoggleMode} from "../../redux/settings/dispatchtoggleMode";
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

const SettingsTab = ({navigation}: Props) => {
    let settings = useSettings();
    let dispatchtoggleMode1 = dispatchtoggleMode();
    let toggleDisable1RMpreselect = dispatchToggleDisable1RMpreselect();
    let toggleShowTimer = dispatchToggleShowTimer();
    let store = useStore();
    const FileSaver = require('react-native-fs');

    const [importDialog, setImportDialog] = useState(false)
    let fullImport = dispatchFullImport();
    let setPauseTimer = dispatchSetPauseTimer();
    let setFinishTrainingTimer = dispatchSetFinishTrainingTimer();

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
                <Switch onValueChange={() => dispatchtoggleMode1()} value={settings.mode === "dark"}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Preselect 1RM Button</Text>
                <Switch onValueChange={() => toggleDisable1RMpreselect()} value={!settings.toggles?.disable1RMButton}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Use Imperial Units</Text>
                <Switch onValueChange={showAlert} value={false}/>
            </View>
            <View style={styles.row}>
                <Text style={{alignSelf: 'center'}}>Show Training Timer</Text>
                <Switch onValueChange={() => toggleShowTimer()} value={!settings.toggles?.disableTimer}/>
            </View>
            <View style={styles.divider}><Divider/></View>
            <View style={styles.button}>
                <TimeRangePicker setPauseTimer={setPauseTimer}
                                title={'Pause Timer: '}
                                timeRange={settings.localNotification?.pauseTimerInSeconds}/>
                <TimeRangePicker setPauseTimer={setFinishTrainingTimer}
                                title={'Finish Training Timer: '}
                                timeRange={settings.localNotification?.finishTrainingTimerInSeconds}/>
            </View>
            <View style={styles.divider}><Divider/></View>
            <View style={styles.button}><Button mode="elevated" onPress={() => {
                    setImportDialog(true)
                }}>Import all Data</Button></View>
            <View style={styles.button}>
                <Button mode="elevated" onPress={() => {
                    dumbFullStateToFile()
                }}>Export all Data</Button>
            </View>
            <Portal>
                <Dialog visible={importDialog} onDismiss={() => setImportDialog(false)}>
                    <Dialog.Title>Import full data from backup file?</Dialog.Title>
                    <Dialog.Content>
                        <Text>This action will replace all existing data in your current application with the data from the selected file. Continue?</Text>
                    </Dialog.Content>
                    <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'space-between'}}>
                        <Dialog.Actions>
                            <Button onPress={() => {
                                doce();
                                setImportDialog(false)
                            }}>Import</Button>
                        </Dialog.Actions>
                        <Dialog.Actions>
                            <Button onPress={() =>
                                setImportDialog(false)
                            }>Cancel</Button>
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
