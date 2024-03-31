import React, {useEffect, useState} from 'react';
import {SafeAreaView, ScrollView, View} from 'react-native';
import {Button, IconButton, SegmentedButtons, Text, TextInput, useTheme} from 'react-native-paper';
import {NativeStackHeaderProps, NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {useTrainingsPlan} from '../../redux/Training/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../redux/Training/useTrainingInTrainingsPlan';
import PlanWorkoutInTraining from '../../components/PlanTraining';
import ExecuteWorkoutInTraining from '../../components/ExecuteTraining';
import {dispatchStartTraining} from '../../redux/Training/dispatchStartTraining';
import {useExerciseByIds} from '../../redux/Exercises/useExerciseByIds';
import {dispatchModifyExercisesInTraining} from '../../redux/Training/dispatchModifyExercisesInTraining';
import {dispatchFinishTraining} from '../../redux/Training/dispatchFinishTraining';
import TrainingHistory from '../../components/TrainingHistory';
import {TrainingsState} from '../../models/TrainingsState';
import DraggableExercise from '../../components/DraggableExercise';
import Picker from '../../components/Picker';
import Timer from '../../components/Timer';
import TrainingsOverview from '../../components/TrainingsOverview';
import TrainingsBase from '../../components/TrainingsBase';
import {Exercise} from '../../models/Exercise';
import dispatchChangeTrainingsName from '../../redux/Training/dispatchChangeTrainingsName';
import MicroOverview from "../../components/MicroOverview";
import PlanningOverview from "../../components/PlanningOverview";

interface headerProps {
    trainingsPlanName: string;
    trainingName?: string;
    micro: number;
    training: number;
    props: NativeStackHeaderProps;
    changeName: (name: string) => void;
    onShowDone: () => void;
    showDone: boolean;
    onShowPlanned: () => void;
    showPlanned: boolean;
}

const header = ({
                    trainingsPlanName,
                    trainingName,
                    micro,
                    training,
                    props,
                    changeName,
                    showPlanned,
                    onShowPlanned,
                    showDone,
                    onShowDone
                }: headerProps) => {
    let theme = useTheme();
    const [editTrainingName, setEditTrainingName] = useState(false);
    const [trainingsName, setTrainingsName] = useState(trainingName ?? 'Training' + training);

    useEffect(() => {
        if (trainingName === undefined) {
            setTrainingsName('Training ' + training);
        } else {
            setTrainingsName(trainingName);
        }
    }, [trainingName]);
    return (
        //TODO 56 dp does only work for android chatgpt says it should be 44 for ios
        <View style={{height: 56, display: 'flex', flexDirection: 'row', backgroundColor: theme.colors.background}}>
            <IconButton size={24} icon={'arrow-left'} onPress={() => props.navigation.goBack()}></IconButton>
            <View style={{display: 'flex', flexDirection: 'column'}}>
                <Text
                    style={{fontSize: theme.fonts.titleMedium.fontSize, fontWeight: 'bold'}}>{trainingsPlanName}</Text>
                <View style={{display: 'flex', flexDirection: 'row'}}>
                    <Text
                        style={{
                            fontSize: 20,
                        }}>
                        Micro {micro}
                    </Text>
                    {!editTrainingName && (
                        <Text
                            style={{
                                fontSize: 20,
                            }}
                            onPress={() => setEditTrainingName(true)}>
                            {' '}
                            {trainingsName}
                        </Text>
                    )}
                    {editTrainingName && (
                        <TextInput
                            value={trainingsName}
                            onChangeText={(text) => {
                                setTrainingsName(text);
                            }}
                            onEndEditing={() => {
                                changeName(trainingsName);
                                setEditTrainingName(false);
                            }}
                        />
                    )}
                </View>
            </View>
            <View style={{display: 'flex', flexDirection: 'column'}}>
                <Text>Micro overview</Text>
                <View style={{display: 'flex', flexDirection:'row'}}>
                    <Button mode={showPlanned ? 'contained' : 'outlined'} onPress={onShowPlanned}>
                        Plan
                    </Button>
                    <Button mode={showDone ? 'contained' : 'outlined'} onPress={onShowDone}>
                        Done
                    </Button>
                </View>
            </View>

        </View>
    );
};

const TrainingsPlanTab = ({navigation, route}: Props) => {
    const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
    const [micro, setMicro] = useState(1);
    const [trainingInMicro, setTrainingInMicro] = useState(1);
    const [timeInWorkout, setTimeInWorkout] = useState(new Date(Date.now()));
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const lastTraining = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro - 1, trainingInMicro);
    const startTraining = dispatchStartTraining(training?.id);
    const [overview, setOverview] = useState(true);
    let exercises = useExerciseByIds(training?.exercises ?? []);
    let [showPlanned, setShowPlanned] = useState(false);
    let [showDone, setShowDone] = useState(false);
    const [chosenExercises, setchosenExercise] = useState(exercises?.length > 1 ? exercises[0].id : undefined);
    let chosenExercise = exercises.find((exercise) => exercise.id === chosenExercises);
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let finishTraining = dispatchFinishTraining();
    let chChangeTrainingsName = dispatchChangeTrainingsName();
    navigation.setOptions({
        header: (props) =>
            header({
                trainingsPlanName: trainingsPlan.name,
                trainingName: trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro,
                micro,
                training: trainingInMicro,
                props,
                changeName: (name) => chChangeTrainingsName(trainingsPlan.id!!, name, trainingInMicro),
                onShowDone: () => setShowDone(!showDone),
                onShowPlanned: () => setShowPlanned(!showPlanned),
                showPlanned,
                showDone,
            }),
    });
    const handleValueChange = (newValue: any) => {
        switch (newValue) {
            case 'micro - 1':
                setMicro(micro - 1);
                break;
            case 'micro + 1':
                setMicro(micro + 1);
                break;
            case 'training + 1':
                setTrainingInMicro(trainingInMicro + 1);
                break;
            case 'training - 1':
                setTrainingInMicro(trainingInMicro - 1);
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        if (training?.state === TrainingsState.STARTED) {
            startTraining();
        }
    }, [micro, trainingInMicro]);

    function setExerciseWithSideEffects(exercises: Exercise[]) {
        modifyExercisesInTraining(exercises, trainingsPlan.id!!, micro, trainingInMicro, training?.id);
    }

    function changePlanningmode() {
        if (training?.state === TrainingsState.PLANNED) {
            startTraining();
        }
        if (training?.state === TrainingsState.STARTED) {
            finishTraining(training.id!!);
        }
        if (training?.state === TrainingsState.FINISHED) {
            if (chosenExercise === undefined) setchosenExercise(exercises[0].id);
            setOverview(!overview);
        }
        setTimeInWorkout(new Date(Date.now()));
    }

    function goToNextExercise() {
        const number = exercises.indexOf(chosenExercise!!) + 1;
        if (number >= exercises.length) {
            return;
        }
        setTimeInWorkout(new Date(Date.now()));
        setchosenExercise(exercises[number].id);
    }

    return (
        <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
            <ScrollView keyboardShouldPersistTaps={'handled'}>
                <View>
                    {showDone && <MicroOverview trainingsPlan={trainingsPlan} micro={micro}/>}
                    <Picker exercise={exercises} setExercise={setExerciseWithSideEffects}/>
                    <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                        {training?.state === TrainingsState.STARTED &&
                            <Timer start={training.start!!} label={'Start Training'}/>}
                        <Button mode="outlined" onPress={changePlanningmode}>
                            {training?.state === undefined && 'Plan Training'}
                            {training?.state === TrainingsState.PLANNED && 'Start Training'}
                            {training?.state === TrainingsState.STARTED && 'Finish Training'}
                            {training?.state === TrainingsState.FINISHED && overview && 'Show Sets'}
                            {training?.state === TrainingsState.FINISHED && !overview && 'Show Overview'}
                        </Button>
                        {training?.state === TrainingsState.STARTED &&
                            <Timer start={timeInWorkout} reset={true} label={'Last Set'}/>}
                    </View>
                    {(training?.state === TrainingsState.STARTED || training?.state === TrainingsState.PLANNED || training === undefined) && (
                        <View>
                            <DraggableExercise
                                exercises={exercises}
                                setExercises={setExerciseWithSideEffects}
                                chosenExercise={chosenExercise}
                                chooseExercise={(exercise) => {
                                    setchosenExercise(exercise.id);
                                }}
                            />
                        </View>
                    )}
                    {training === undefined && <TrainingsBase trainingsPlan={trainingsPlan}
                                                              micro={micro}
                                                              trainingInMicro={trainingInMicro}/>}

                    {chosenExercise && training?.state === TrainingsState.PLANNED && (
                        <PlanWorkoutInTraining training={training}
                                               trainingsPlanId={trainingsPlan.id!!}
                                               trainingInMicro={trainingInMicro}
                                               micro={micro}
                                               chosenExercise={chosenExercise!!}/>
                    )}
                    {showPlanned && <PlanningOverview trainingsPlan={trainingsPlan} micro={micro}/>}
                    {training?.state === TrainingsState.STARTED && chosenExercise && (
                        <ExecuteWorkoutInTraining training={training}
                                                  chosenExercise={chosenExercise!!}
                                                  onSubmit={() => goToNextExercise()}
                                                  onSubmitSet={() => setTimeInWorkout(new Date(Date.now()))}/>
                    )}
                    {training?.state === TrainingsState.FINISHED && overview &&
                        <TrainingsOverview training={training} previousTraining={lastTraining}/>}

                    {training?.state === TrainingsState.FINISHED && !overview &&
                        <TrainingHistory training={training}/>}
                </View>
            </ScrollView>
            <SafeAreaView>
                <SegmentedButtons
                    style={{paddingHorizontal: 5}}
                    value={''}
                    onValueChange={handleValueChange}
                    buttons={[
                        {
                            icon: 'chevron-left',
                            value: 'micro - 1',
                            label: 'Micro ' + (micro - 1),
                            disabled: micro === 1
                        },
                        {icon: 'chevron-right', value: 'micro + 1', label: 'Micro ' + (micro + 1)},
                        {
                            icon: 'chevron-up',
                            value: 'training - 1',
                            label: trainingsPlan.trainingNames?.[trainingInMicro - 1] ?? 'Training ' + (trainingInMicro - 1),
                            disabled: trainingInMicro === 1,
                        },
                        {
                            icon: 'chevron-down',
                            value: 'training + 1',
                            label: trainingsPlan.trainingNames?.[trainingInMicro + 1] ?? 'Training ' + (trainingInMicro + 1),
                        },
                    ]}
                />
            </SafeAreaView>
        </View>
    );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
