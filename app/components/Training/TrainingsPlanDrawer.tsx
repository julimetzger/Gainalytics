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
import {TrainingsPlan} from "../../models/TrainingsPlan";
import {View, Keyboard} from "react-native";
import React, {useState, useRef, useEffect} from "react";

interface TrainingsPlanDrawerProps {
    theme: ThemeBase & {
        version: 3;
        isV3: true;
        colors: MD3Colors;
        fonts: MD3Typescale
    };
    changeTrainingsName: (trainingsPlanId: number, trainingsName: string, trainingsNumber: number) => Action<any>;
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
    changeTrainingsName,
    trainingsPlan,
    setTrainingInMicro,
    setOpen,
    showPlanned,
    setShowPlanned,
    setShowDone,
    handleValueChange,
    micro
}: TrainingsPlanDrawerProps) => {
    const [edit, setEdit] = useState<number | undefined>(undefined);
    const [trainingsName, setTrainingsName] = useState('');
    const [longPressIndex, setLongPressIndex] = useState<number | undefined>(undefined);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!trainingsPlan.trainingNames || Object.keys(trainingsPlan.trainingNames).length === 0) {
            changeTrainingsName(trainingsPlan.id!!, 'Training 1', 1);
        }
    }, [trainingsPlan, changeTrainingsName]);

    return (<View style={{display: 'flex', flexDirection: 'column'}}>
        <Divider/>
        <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
            <Text style={{fontSize: theme.fonts.headlineSmall.fontSize, marginLeft: 5}}>Trainings:</Text>
        </View>
        {Object.entries(trainingsPlan.trainingNames ?? []).map(([micro, name], index) => {
            return (
                <View key={index} style={{display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40}}>
                    <TouchableRipple
                        style={{flex: 1}}
                        onPress={() => {
                            setTrainingInMicro(parseInt(micro))
                            setOpen(false);
                            setShowDone(false);
                        }}
                        onLongPress={() => setLongPressIndex(index)}
                    >
                        <View>
                            {(edit === undefined || edit !== index) && (
                                <Text style={{fontSize: 20, margin: 5}}>
                                    {name}
                                </Text>
                            )}
                            {(edit !== undefined && edit === index) ? (
                                <TextInput
                                    ref={inputRef}
                                    mode='outlined'
                                    maxLength={20}
                                    value={trainingsName}
                                    onChangeText={(text) => {
                                        setTrainingsName(text);
                                    }}
                                    onEndEditing={() => {
                                        changeTrainingsName(trainingsPlan.id!!, trainingsName, index + 1);
                                        setEdit(undefined);
                                        setTrainingsName('');
                                        inputRef.current?.blur();
                                        Keyboard.dismiss();
                                    }}
                                    selectTextOnFocus={true}
                                    right={
                                        <TextInput.Icon
                                            icon="check"
                                            onPress={() => {
                                                changeTrainingsName(trainingsPlan.id!!, trainingsName, index + 1);
                                                setEdit(undefined);
                                                setTrainingsName('');
                                                inputRef.current?.blur();
                                                Keyboard.dismiss();
                                            }}
                                        />
                                    }
                                />
                            ) : null}
                        </View>
                    </TouchableRipple>
                    {edit !== index && (
                        longPressIndex === index ? (
                            <IconButton
                                icon="delete"
                                onPress={() => {
                                    // Add delete logic here
                                    setLongPressIndex(undefined);
                                }}
                                size={20}
                                style={{marginRight: 5}}
                            />
                        ) : (
                            <IconButton
                                icon="pencil"
                                onPress={() => {
                                    setEdit(index);
                                    setTrainingsName(name);
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                }}
                                size={20}
                                style={{marginRight: 5}}
                            />
                        )
                    )}
                </View>
            );
        })}
        <View>
            <IconButton
                icon="plus-circle" onPress={() => {
                changeTrainingsName(trainingsPlan.id!!, 'Training ' + (Object.keys(trainingsPlan.trainingNames ?? []).length + 1), Object.keys(trainingsPlan.trainingNames ?? []).length + 1)
                }}
                theme={theme}
                iconColor={theme.colors.tertiaryContainer}
                size={40}>
            </IconButton>
        </View>
        <Divider/>
        <TouchableRipple>
            <Tooltip title='Displays workout statistics for this Micro'>
                <Text style={{fontSize: 20, margin: 5}}
                        onPress={() => {
                        setOpen(false);
                        setShowDone(true);
                        }}>
                    Overview
                </Text>
            </Tooltip>
        </TouchableRipple>
        <Divider style={{marginVertical: 5}}/>
        <Tooltip title='Displays the planned workout statistics for this Micro'>
            <Button mode={showPlanned ? 'contained' : 'outlined'}
                    onPress={() => setShowPlanned(!showPlanned)}>
                Enable Planning Mode
            </Button>
        </Tooltip>
        <SegmentedButtons
            style={{marginTop: 5}}
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
