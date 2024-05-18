import {Text, useTheme} from "react-native-paper";
import React from "react";
import {View} from "react-native";
import {TrainingsState} from "../models/TrainingsState";

interface headerProps {
    trainingsPlanName: string;
    trainingName: string;
    micro: number;
    mode: string;
    drawerMenu: React.ReactNode;
}

const TrainingsPlanHeader = ({
                                 trainingsPlanName,
                                 trainingName,
                                 micro,
                                 mode,
                                 drawerMenu
                             }: headerProps) => {
    let theme = useTheme();
    return (
        //TODO 56 dp does only work for android chatgpt says it should be 44 for ios
        <View style={{
            marginTop: 24,
            height: 56,
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: theme.colors.background
        }}>
            {drawerMenu}
            <View style={{flex: 1, justifyContent: 'space-between', alignItems: 'flex-end', flexDirection: 'row'}}>
                <View style={{flexDirection: 'column'}}>
                    <Text
                        style={{
                            fontSize: theme.fonts.titleMedium.fontSize,
                            fontWeight: 'bold'
                        }}>{trainingsPlanName}</Text>
                    <View style={{display: 'flex', flexDirection: 'row'}}>
                        <Text
                            style={{
                                fontSize: 20,
                            }}>
                            Micro {micro}
                        </Text>
                        <Text
                            style={{
                                fontSize: 20,
                            }}>
                            {" " + trainingName}
                        </Text>
                    </View>
                </View>
                {mode !== 'Overview' &&
                    <View style={{flexDirection: 'column', width: 80, marginEnd: 10}}>
                        <Text
                            style={{fontSize: theme.fonts.titleMedium.fontSize, fontWeight: 'bold'}}>Mode</Text>
                        <Text
                            style={{
                                fontSize: 20,
                            }}>
                            {mode === undefined && 'Planning'}
                            {mode === TrainingsState.PLANNED && 'Planning'}
                            {mode === TrainingsState.STARTED && 'Active'}
                            {mode === TrainingsState.FINISHED && 'Done'}
                        </Text>
                    </View>}
            </View>
        </View>
    );
};

export default TrainingsPlanHeader;
