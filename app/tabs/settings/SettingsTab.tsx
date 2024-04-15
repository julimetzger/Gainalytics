import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React from "react";
import {Alert, View} from "react-native";
import {Button, Switch, Text} from "react-native-paper";
import {dispatchtoggleMode} from "../../redux/settings/dispatchtoggleMode";
import {useSettings} from "../../redux/settings/useSettings";
import {useStore} from "react-redux";

const SettingsTab = ({}: Props) => {
    let settings = useSettings();
    let dispatchtoggleMode1 = dispatchtoggleMode();
    let store = useStore();
    const FileSaver = require('react-native-fs');

    function dumbFullStateToFile() {
        const state = store.getState();
        var path = FileSaver.DownloadDirectoryPath + '/' + Date.now() + '.gains';
        FileSaver.writeFile(path, JSON.stringify(state));
    }

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
            <Button onPress={() => {
                dumbFullStateToFile()
                Alert.alert('exported to ' + FileSaver.DownloadDirectoryPath + '/test.gains');
            }}>export All Data</Button>
        </View>

    );
}

export type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default SettingsTab;
