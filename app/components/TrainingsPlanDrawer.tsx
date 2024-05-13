import {
    Button,
    Divider,
    IconButton,
    SegmentedButtons,
    Text, TextInput,
    ThemeBase,
    Tooltip,
    TouchableRipple
} from "react-native-paper";
import {MD3Colors, MD3Typescale} from "react-native-paper/lib/typescript/types";
import {Action} from "redux";
import {TrainingsPlan} from "../models/TrainingsPlan";
import {View} from "react-native";
import React, {useState} from "react";

interface TrainingsPlanDrawerProps {
    theme: ThemeBase & {
        version: 3;
        isV3: true;
        colors: MD3Colors;
        fonts: MD3Typescale
    };
    chChangeTrainingsName: (trainingsPlanId: number, trainingsName: string, trainingsNumber: number) => Action<any>;
    trainingsPlan: TrainingsPlan;
    setTrainingInMicro: (value: (((prevState: number) => number) | number)) => void;
    setOpen: (value: (((prevState: boolean) => boolean) | boolean)) => void;
    showPlanned: boolean;
    setShowPlanned: (value: (((prevState: boolean) => boolean) | boolean)) => void;
    showDone: boolean;
    setShowDone: (value: (((prevState: boolean) => boolean) | boolean)) => void;
    handleValueChange: (newValue: any) => void;
    micro: number;
}

const TrainingsPlanDrawer = ({
                                 theme,
                                 chChangeTrainingsName,
                                 trainingsPlan,
                                 setTrainingInMicro,
                                 setOpen,
                                 showPlanned,
                                 setShowPlanned,
                                 setShowDone,
                                 handleValueChange,
                                 micro
                             }: TrainingsPlanDrawerProps) => {
    const [edit, setEdit] = useState<number | undefined>(undefined)
    const [trainingsName, setTrainingsName] = useState('');

    return (<View style={{display: 'flex', flexDirection: 'column'}}>
        <Divider/>
        <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{fontSize: theme.fonts.headlineSmall.fontSize, marginLeft: 5}}>Trainings</Text>
            <IconButton
                icon="plus-circle" onPress={() => {
                chChangeTrainingsName(trainingsPlan.id!!, 'Training ' + (Object.keys(trainingsPlan.trainingNames ?? []).length + 1), Object.keys(trainingsPlan.trainingNames ?? []).length + 1)
            }}
                theme={theme}
                iconColor={theme.colors.tertiaryContainer}
                size={40}>
            </IconButton>
        </View>
        {Object.entries(trainingsPlan.trainingNames ?? []).map(([micro, name], index) => {
            return (
                <TouchableRipple
                    style={{minHeight: 40}}
                    key={index}
                    onPress={() => {
                        setTrainingInMicro(parseInt(micro))
                        setOpen(false);
                        setShowDone(false);
                    }}
                    onLongPress={() => {
                        setEdit(index)
                        setTrainingsName(name)
                    }}
                >
                    <View>
                        {(edit === undefined || edit !== index) && (
                            <Text
                                style={{
                                    fontSize: 20,
                                    margin: 5,
                                }}>
                                {name}
                            </Text>
                        )}
                        {(edit !== undefined && edit === index) ? (
                            <TextInput
                                mode='outlined'
                                maxLength={20}
                                value={trainingsName}
                                onChangeText={(text) => {
                                    setTrainingsName(text);
                                }}
                                onEndEditing={() => {
                                    chChangeTrainingsName(trainingsPlan.id!!, trainingsName, index + 1)
                                    setEdit(undefined);
                                    setTrainingsName('');
                                }}
                            />
                        ) : null}</View>

                </TouchableRipple>
            );
        })}
        <TouchableRipple>
            <Tooltip title='Displays workout statistics for this Micro'>
                <Text
                    style={{
                        fontSize: 20,
                        margin: 5,
                    }}
                    onPress={() => {
                        setOpen(false);
                        setShowDone(true);
                    }}
                >
                    Overview
                </Text>
            </Tooltip>
        </TouchableRipple>
        <Divider style={{marginBottom: 20}}/>
        <Tooltip title='Displays the planned workout statistics for this Micro'>
            <Button mode={showPlanned ? 'contained' : 'outlined'}
                    onPress={() => setShowPlanned(!showPlanned)}>
                Enable Planning Mode
            </Button>
        </Tooltip>
        <SegmentedButtons
            style={{paddingHorizontal: 5, marginTop:5}}
            value={''}
            onValueChange={handleValueChange}
            buttons={[
                {
                    icon: 'chevron-left',
                    value: 'micro - 1',
                    label: 'Micro ' + (micro - 1),
                    disabled: micro === 1
                },
                {
                    icon: 'chevron-right',
                    value: 'micro + 1',
                    label: 'Micro ' + (micro + 1)
                },
            ]}
        />
    </View>)
}

export default TrainingsPlanDrawer;
