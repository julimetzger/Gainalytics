import React, {useEffect, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Button, IconButton, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
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
import TrainingsPlanHeader from "../../components/TrainingsPlanHeader";
import TrainingsPlanDrawer from "../../components/TrainingsPlanDrawer";


const TrainingsPlanTab = ({navigation, route}: Props) => {
    const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
    const [open, setOpen] = useState(false);
    const [micro, setMicro] = useState(route.params.micro ?? 1);
    const [trainingInMicro, setTrainingInMicro] = useState(route.params.training ?? 1);
    const [timeInWorkout, setTimeInWorkout] = useState(new Date(Date.now()));
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const lastTraining = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro - 1, trainingInMicro);
    const startTraining = dispatchStartTraining(training?.id);
    const [refresHeky, setRefresHeky] = useState(Math.random());
    const [overview, setOverview] = useState(true);
    let exercises = useExerciseByIds(training?.exercises ?? []);
    let [showPlanned, setShowPlanned] = useState(false);
    let [showDone, setShowDone] = useState(false);
    const [chosenExercises, setchosenExercise] = useState(exercises?.length > 1 ? exercises[0].id : undefined);
    let chosenExercise = exercises.find((exercise) => exercise.id === chosenExercises);
    let doneExerciseIds = training?.doneWorkoutIds ? Object.keys(training.doneWorkoutIds).map(key => parseInt(key)) : [];
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let finishTraining = dispatchFinishTraining();
    let changeTrainingsName = dispatchChangeTrainingsName();
    let theme = useTheme();
    navigation.setOptions({
        header: (props) =>
            <TrainingsPlanHeader trainingsPlanName={trainingsPlan.name}
                                 trainingName={showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
                                 micro={micro}
                                 mode={showDone ? 'Overview' : training?.state}
                                 drawerMenu={<IconButton
                                     icon="menu"
                                     onPress={() => setOpen((prevOpen) => !prevOpen)}>
                                 </IconButton>}/>
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
                text2: `You started ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
                position: 'top',
                visibilityTime: 5000,
            })
        }
        if (training?.state === TrainingsState.STARTED) {
            finishTraining(training.id!!, trainingsPlan.id!!);
            Toast.show({
                type: 'info',
                text1: 'Training finished!',
                text2: `Congratulations, you finished ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
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
        setRefresHeky(Math.random());
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
            renderDrawerContent={() =>
                <TrainingsPlanDrawer trainingsPlan={trainingsPlan}
                                     micro={micro}
                                     changeTrainingsName={changeTrainingsName}
                                     theme={theme}
                                     handleValueChange={handleValueChange}
                                     setShowPlanned={setShowPlanned}
                                     showPlanned={showPlanned}
                                     setTrainingInMicro={setTrainingInMicro}
                                     setOpen={setOpen}
                                     setShowDone={setShowDone}
                                     showDone={showDone}
                />
            }
        >
            <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
                <ScrollView keyboardShouldPersistTaps={'handled'}>
                    <View>
                        {showDone ? <MicroOverview trainingsPlan={trainingsPlan} micro={micro}/> :
                            (<View><Picker exercise={exercises} setExercise={setExerciseWithSideEffects}
                                           dropdownLabel='Select Exercises for your Training'
                                           hideChip={true}/>
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
                                                                  key={refresHeky}
                                                                  chosenExercise={chosenExercise!!}
                                                                  onSubmit={() => goToNextExercise()}
                                                                  onSubmitSet={() => setTimeInWorkout(new Date(Date.now()))}/>
                                    )}
                                    {training?.state === TrainingsState.FINISHED && overview &&
                                        <TrainingsOverview training={training} previousTraining={lastTraining}/>}
                                    {training?.state === TrainingsState.FINISHED && !overview &&
                                        <TrainingHistory training={training}/>}
                                </View>
                            )
                        }
                    </View>
                </ScrollView>
            </View>
        </Drawer>
    );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
