import {ScrollView, View} from "react-native";
import {Card, Text} from "react-native-paper";
import React from "react";
import {useWorkoutsByIds} from "../../../redux/Workout/use/useWorkoutsByIds";
import MetricsOverviewForWorkouts from "../../analyse/MetricsOverviewForWorkouts";
import {calculateMetricComparisons} from "../../../utils/AnalyseUtils";
import MetricView from "../../analyse/MetricComparison";
import {Metric} from "../../picker/elements/TrainingElementPicker";
import {Training} from "../../../models/Training";
import {Workout} from "../../../models/Workout";

interface TrainingsOverviewProps {
    training: Training,
    previousTraining?: Training
}

const TrainingsOverview = ({training, previousTraining}: TrainingsOverviewProps) => {
    let trainingsWorkouts = useWorkoutsByIds(Object.values(training.doneWorkoutIds));
    let previousWorkouts = useWorkoutsByIds(previousTraining ? Object.values(previousTraining.doneWorkoutIds) : []);

    const trainingDate = new Date(new Date(training.end!!).getTime() - new Date(training.start!!).getTime());
    const previousTrainingTime = previousTraining?.end ? new Date(new Date(previousTraining.end!!).getTime() - new Date(previousTraining.start!!).getTime()) : undefined;
    let formattedDifference;
    if (previousTrainingTime) {
        let difference = (trainingDate.getTime() - previousTrainingTime.getTime());
        let isNegative = difference < 0;
        let absoluteDifference = Math.abs(difference);
        formattedDifference = (isNegative ? '-' : '+') + new Date(absoluteDifference).toISOString().substring(11, 19);
    }
    let workoutSets = trainingsWorkouts.flatMap((workout: Workout) => workout.sets);
    let prviousWorkoutSets = previousWorkouts.flatMap((workout: Workout) => workout.sets);
    let metricToComparison = calculateMetricComparisons({
        currentWorkoutSets: workoutSets,
        lastWorkoutSets: prviousWorkoutSets
    });
    return (
        <ScrollView>
            <View>
                <View style={{display: 'flex', flexDirection: 'row', flex: 1}}>
                    <Card style={{margin: 5, flex: 1}}>
                        <Card.Title title={<Text>Duration</Text>}></Card.Title>
                        <Card.Content>
                            {formattedDifference && <Text>{formattedDifference}</Text>}
                            <Text>{trainingDate.toISOString().substring(11, 19)}</Text>
                        </Card.Content>
                    </Card>
                    <Card style={{margin: 5, flex: 1}}>
                        <Card.Title title={<Text>Volume</Text>}/>
                        <Card.Content>
                            <Text><MetricView comparison={metricToComparison.get(Metric.VOLUME)!!}/></Text>
                        </Card.Content>
                    </Card>
                    <Card style={{margin: 5, flex: 1}}>
                        <Card.Title title={<Text>Sets</Text>}/>
                        <Card.Content>
                            <Text><MetricView comparison={metricToComparison.get(Metric.SETS)!!}/></Text>
                        </Card.Content>
                    </Card>
                </View>
                <MetricsOverviewForWorkouts trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts}/>
            </View>

        </ScrollView>
    );
}

export default TrainingsOverview;
