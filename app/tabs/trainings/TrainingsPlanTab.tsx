import React, {useEffect, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {
    Button,
    Divider,
    IconButton,
    SegmentedButtons,
    Text,
    TextInput,
    TouchableRipple,
    useTheme
} from 'react-native-paper';
import {NativeStackHeaderProps, NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {Drawer} from 'react-native-drawer-layout';
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
import Toast from "react-native-toast-message";

interface headerProps {
    trainingsPlanName: string;
    trainingName?: string;
    micro: number;
    training: number;
    props: NativeStackHeaderProps;
    changeName: (name: string) => void;
    mode: string;
}

const header = ({
                    trainingsPlanName,
                    trainingName,
                    micro,
                    training,
                    props,
                    changeName,
                    mode
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
                </View>
            </View>
        </View>
    );
};

const TrainingsPlanTab = ({navigation, route}: Props) => {
    const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
    const [open, setOpen] = useState(false);
    const [micro, setMicro] = useState(route.params.micro ?? 1);
    const [trainingInMicro, setTrainingInMicro] = useState(route.params.training ?? 1);
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
    let doneExerciseIds = training?.doneWorkoutIds ? Object.keys(training.doneWorkoutIds).map(key => parseInt(key)) : [];
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let finishTraining = dispatchFinishTraining();
    let chChangeTrainingsName = dispatchChangeTrainingsName();
    let theme = useTheme();
    navigation.setOptions({
        header: (props) =>
            header({
                trainingsPlanName: trainingsPlan.name,
                trainingName: trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro,
                micro,
                training: trainingInMicro,
                props,
                changeName: (name) => chChangeTrainingsName(trainingsPlan.id!!, name, trainingInMicro),
                mode: training?.state
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
            Toast.show({
                type: 'info',
                text1: 'Training started!',
                text2: `You started the training ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
                position: 'top',
                visibilityTime: 5000,
            })
        }
        if (training?.state === TrainingsState.STARTED) {
            finishTraining(training.id!!, trainingsPlan.id!!);
            Toast.show({
                type: 'info',
                text1: 'Training finished!',
                text2: `Congratulations you finished the training ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
                position: 'top',
                visibilityTime: 5000,
            })
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
        <Drawer
            drawerStyle={{backgroundColor: theme.colors.background}}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            drawerType={"front"}
            renderDrawerContent={() => {
                return <View style={{display: 'flex', flexDirection: 'column'}}>
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
                    {Object.entries(trainingsPlan.trainingNames ?? []).map(
                        ([micro, name], index) => {
                            return <TouchableRipple style={{height: 40}} key={index} onPress={() => {
                                setTrainingInMicro(parseInt(micro))
                                setOpen(false)
                            }}><Text style={{fontSize: theme.fonts.bodyLarge.fontSize, margin: 5}}>{name}</Text>
                            </TouchableRipple>
                        })}
                    <Divider/>
                    <Text style={{fontSize: theme.fonts.headlineSmall.fontSize, margin: 5}}>Micro Overview</Text>
                    <Button mode={showPlanned ? 'contained' : 'outlined'} onPress={() => setShowPlanned(!showPlanned)}>
                        Show Planned
                    </Button>
                    <Button mode={showDone ? 'contained' : 'outlined'} onPress={() => setShowDone(!showDone)}>
                        Show Done
                    </Button>
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
                            {
                                icon: 'chevron-right',
                                value: 'micro + 1',
                                label: 'Micro ' + (micro + 1)
                            },
                        ]}
                    />
                </View>;
            }}
        >
            <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
                <IconButton
                    icon="menu"
                    onPress={() => setOpen((prevOpen) => !prevOpen)}>
                </IconButton>
                <ScrollView keyboardShouldPersistTaps={'handled'}>
                    <View>
                        {showDone && <MicroOverview trainingsPlan={trainingsPlan} micro={micro}/>}
                        <Picker exercise={exercises} setExercise={setExerciseWithSideEffects}/>
                        <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                            {training?.state === TrainingsState.STARTED &&
                                <Timer start={training.start!!} label={'Start Training'}/>}
                            {training?.state && <Button mode="outlined" onPress={changePlanningmode}>
                                {training?.state === TrainingsState.PLANNED && 'Start Training'}
                                {training?.state === TrainingsState.STARTED && 'Finish Training'}
                                {training?.state === TrainingsState.FINISHED && overview && 'Show Sets'}
                                {training?.state === TrainingsState.FINISHED && !overview && 'Show Overview'}
                            </Button>}
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
                                    doneExerciseIds={doneExerciseIds}
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
            </View>
        </Drawer>
    );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
