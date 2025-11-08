import {Pressable, ScrollView, StyleSheet, View} from "react-native";
import React, {useEffect, useState} from "react";
import {Button, Card, IconButton, ProgressBar, Text, TextInput} from "react-native-paper";
import {useAllTrainingsPlans} from "../../redux/Training/useAllTrainingsPlans";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import AddTrainingsPlan from "../../components/Training/add/AddTrainingsPlan";
import {TrainingsState} from "../../models/TrainingsState";
import {useTrainings} from "../../redux/Training/useTrainings";
import {Exercise} from "../../models/Exercise";
import {TrainingsPlan} from "../../models/TrainingsPlan";
import {
    getMicroFromTrainingInMicroIndex,
    getTrainingFromTrainingInMicroIndex
} from "../../redux/Training/trainingsPlanReducer";
import {useSettings} from "../../redux/settings/useSettings";
import {TextInput as RNTextInput} from 'react-native';
import TrainingOverviewCard from "../../components/Training/analyse/TrainingOverviewCard";

interface TrainingMapping {
    firstStartedTraining?: {
        micro: number;
        training: number;
        percentOfDone: number;
    }
    lastDoneTraining?: {
        micro: number;
        training: number;
    }
    nextTraining?: {
        micro: number;
        training: number;
    }
}

const TrainingHome = ({navigation, route}: Props) => {
    const [filter, setFilter] = useState(route.params?.filter || '');
    const [showFilter, setShowFilter] = useState(false);
    const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
    const allTrainings = useTrainings();
    const settings = useSettings();
    let startedTrainings = allTrainings.filter(A => A.state === TrainingsState.STARTED)

    let planToStartTraining = new Map(trainingsPlans.map(train => {
                    let firstStartedTraining = handleStartedTraining(train);
                    let lastDone = lastDonee(train);
                    return [train.id, {
                        firstStartedTraining: firstStartedTraining, lastDoneTraining: lastDone
                    }]
                }
            ).filter(A => A !== undefined) as Array<[number, TrainingMapping]>
        )
    ;

    const filterInputRef = React.useRef<RNTextInput>(null);

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton
                    icon="magnify"
                    onPress={() => {
                        if (showFilter) {
                            setShowFilter(false);
                            setFilter('');
                            filterInputRef.current?.blur();
                        } else {
                            setShowFilter(true);
                            setTimeout(() => {
                                filterInputRef.current?.focus();
                            }, 100);
                        }
                    }}
                />
            ),
        });
    }, [navigation, showFilter]);

    return (
        <View style={{flex: 1}}>
            {showFilter && (
                <TextInput
                    label={'Filter'}
                    value={filter}
                    onChangeText={(text) => setFilter(text)}
                    ref={filterInputRef}
                />
            )}
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {trainingsPlans
                    .filter((exercise: TrainingsPlan) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((trainingsPlan: TrainingsPlan) => (
                        <Card style={{margin: 5}} key={trainingsPlan.id}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate({
                                        name: 'Training',
                                        params: {trainingsPlan: trainingsPlan},
                                    })
                                }>
                                <View style={{
                                    flexDirection: 'row',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Text style={styles.exerciseText}> {trainingsPlan.name}</Text>
                                    <AddTrainingsPlan trainingsId={trainingsPlan.id}/>
                                </View>
                                <ProgressBar
                                    visible={planToStartTraining.get(trainingsPlan.id!!)?.firstStartedTraining !== undefined}
                                    progress={planToStartTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.percentOfDone}>
                                </ProgressBar>
                                <TrainingOverviewCard trainingsPlan={trainingsPlan}
                                                      currentMicro={lastDonee(trainingsPlan)?.micro}/>
                                <View style={styles.buttonContainer}>
                                    {planToStartTraining.get(trainingsPlan.id!!)?.nextTraining &&
                                        <Button style={styles.button} onPress={() =>
                                            navigation.navigate({
                                                name: 'Training',
                                                params: {
                                                    trainingsPlan: trainingsPlan,
                                                    micro: planToStartTraining.get(trainingsPlan.id!!)?.nextTraining?.micro,
                                                    training: planToStartTraining.get(trainingsPlan.id!!)?.nextTraining?.training
                                                },
                                            })
                                        }>Next Training</Button>}
                                    {planToStartTraining.get(trainingsPlan.id!!)?.firstStartedTraining &&
                                        <Button style={styles.button} onPress={() =>
                                            navigation.navigate({
                                                name: 'Training',
                                                params: {
                                                    trainingsPlan: trainingsPlan,
                                                    micro: planToStartTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.micro,
                                                    training: planToStartTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.training
                                                },
                                            })
                                        }>Active Training</Button>}
                                    {planToStartTraining.get(trainingsPlan.id!!)?.lastDoneTraining &&
                                        <Button style={styles.button} onPress={() =>
                                            navigation.navigate({
                                                name: 'Training',
                                                params: {
                                                    trainingsPlan: trainingsPlan,
                                                    micro: planToStartTraining.get(trainingsPlan.id!!)?.lastDoneTraining?.micro,
                                                    training: planToStartTraining.get(trainingsPlan.id!!)?.lastDoneTraining?.training
                                                },
                                            })
                                        }>Last Training</Button>}
                                </View>
                            </Pressable>
                        </Card>
                    ))
                }
            </ScrollView>
            <AddTrainingsPlan
                style={{
                    position: 'absolute',
                    bottom: 5,
                    [settings.toggles?.showPlusButtonLeft ? 'left' : 'right']: 5
                }}
            />
        </View>
    );

    function handleStartedTraining(train: TrainingsPlan) {
        let idOfTraining = Object.values(train.trainings).find(tr => startedTrainings.map(startetd => startetd.id).includes(tr))
        let training = startedTrainings.find(A => A.id === idOfTraining);
        let numberOfExercises = training ? Object.values(training.exercises).length : 1;
        numberOfExercises = numberOfExercises === 0 ? 1 : numberOfExercises;
        let number = training ? Object.values(training.doneWorkoutIds).length / numberOfExercises : undefined;
        let microTrainingIndex = Object.entries(train.trainings).find(([key, value]) => value === idOfTraining)?.[0];
        return training ? {
            firstStatertedTrainingId: training?.id,
            micro: getMicroFromTrainingInMicroIndex(microTrainingIndex!!),
            training: getTrainingFromTrainingInMicroIndex(microTrainingIndex!!),
            percentOfDone: number
        } : undefined;
    }

    function lastDonee(train: TrainingsPlan): { micro: number; training: number } | undefined {
        let microTrainingIndex = train.lastTraining ? Object.entries(train.trainings).find(([key, value]) => value === train.lastTraining)?.[0] : undefined;
        let lastDone = microTrainingIndex ? {
            micro: getMicroFromTrainingInMicroIndex(microTrainingIndex!!),
            training: getTrainingFromTrainingInMicroIndex(microTrainingIndex!!),
        } : undefined;
        return lastDone;
    }
};

const styles = StyleSheet.create({
    exerciseText: {
        fontSize: 20,
        textAlign: 'left',
        textAlignVertical: 'center',
        margin: 5,
    },
    addExercise: {
        position: 'absolute',
        bottom: 5,
        right: 5
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    button: {
        flex: 1,
        margin: 5,
    }
});

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingHome'>;

export default TrainingHome;
