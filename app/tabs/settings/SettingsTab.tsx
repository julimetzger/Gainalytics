import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React, {useState} from "react";
import {Alert, View} from "react-native";
import {Button, Dialog, Portal, Switch, Text} from "react-native-paper";
import {dispatchtoggleMode} from "../../redux/settings/dispatchtoggleMode";
import {useSettings} from "../../redux/settings/useSettings";
import {useStore} from "react-redux";
import DocumentPicker, {DocumentPickerResponse} from 'react-native-document-picker';
import {GlobalState} from "../../redux/rootReducer";
import {dispatchFullImport} from "../../redux/fullstateactions/dispatchFullImport";
import Toast from "react-native-toast-message";

const SettingsTab = ({navigation}: Props) => {
    let settings = useSettings();
    let dispatchtoggleMode1 = dispatchtoggleMode();
    let store = useStore();
    const FileSaver = require('react-native-fs');
    const [importDialog, setImportDialog] = useState(false)
    let fullImport = dispatchFullImport();

    function dumbFullStateToFile() {
        const state = store.getState();
        let number = Date.now();
        var path = FileSaver.DownloadDirectoryPath + '/' + number + '.gains';
        FileSaver.writeFile(path, JSON.stringify(state));
        Alert.alert('exported to ' + FileSaver.DownloadDirectoryPath + '/' + number + '.gains');
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
        <View>
            <View style={{display: 'flex', flexDirection: 'row'}}>
                <Switch onValueChange={() => dispatchtoggleMode1()} value={settings.mode === "dark"}/>
                <Text style={{alignSelf: 'center'}}>Dark Mode enabled</Text>
            </View>
            <View style={{display: 'flex', flexDirection: 'row'}}>
                <Switch onValueChange={() => dispatchtoggleMode1()} value={settings.mode === "dark"}/>
                <Text style={{alignSelf: 'center'}}>RIR/RPE</Text>
            </View>
            <View style={{display: 'flex', flexDirection: 'row'}}>
                <Switch onValueChange={() => dispatchtoggleMode1()} value={settings.mode === "dark"}/>
                <Text style={{alignSelf: 'center'}}>Show 1RM button</Text>
            </View>
            <Button onPress={() => {
                dumbFullStateToFile()
            }}>Export all data</Button>
            <Button onPress={() => {
                setImportDialog(true)
            }}>Import all data</Button>
            <Portal>
                <Dialog visible={importDialog} onDismiss={() => setImportDialog(false)}>
                    <Dialog.Title>Import full data from backup file?</Dialog.Title>
                    <Dialog.Content>
                        <Text>This action will replace all existing data in your current application with the data from the selected file. Continue?</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => {
                            doce();
                            setImportDialog(false)
                        }}>Import</Button>
                        <Button onPress={() =>
                            setImportDialog(false)
                        }>Cancel</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

export type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default SettingsTab;
