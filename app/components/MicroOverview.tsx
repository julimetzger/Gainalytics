import React from "react";
import {ScrollView, View} from "react-native";
import {useAllTrainingsInMicro} from "../redux/Training/useAllTrainingsInMicro";
import WorkoutSetOverview from "./WorkoutSetOverview";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import {Card, Text} from "react-native-paper";
import MetricView from "./MetricComparison";
import {Metric} from "./Picker";
import {calculateMetricComparisons} from "../utils/RepetitionMaxHelper";
import {sum} from "lodash";

interface TrainingsBaseProps {
    trainingsPlan: TrainingsPlan,
    micro: number
}

const MicroOverview = ({trainingsPlan, micro}: TrainingsBaseProps) => {
    let trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
    let previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro - 1);
    let totalTimeTraining = new Date(sum(trainings.map(training => new Date(training.end!!).getTime() - new Date(training.start!!).getTime())));
    let totalTimePreviousTraining = previousTrainings?.length > 0 ? new Date(sum(previousTrainings.map(training => new Date(training.end!!).getTime() - new Date(training.start!!).getTime()))) : undefined;

    let formattedDifference;
    if (totalTimePreviousTraining) {
        let difference = (totalTimeTraining.getTime() - totalTimePreviousTraining.getTime());
        let isNegative = difference < 0;
        let absoluteDifference = Math.abs(difference);
        formattedDifference = (isNegative ? '-' : '+') + new Date(absoluteDifference).toISOString().substring(11, 19);
    }
    let trainingsWorkouts = useWorkoutsByIds(trainings.flatMap(training => Object.values(training.doneWorkoutIds)));
    let previousWorkouts = useWorkoutsByIds(previousTrainings.length > 0 ? previousTrainings.flatMap(training => Object.values(training.doneWorkoutIds)) : []);
    let metricToComparison = calculateMetricComparisons({
        currentWorkoutSets: trainingsWorkouts.flatMap((workout: Workout) => workout.sets),
        lastWorkoutSets: previousWorkouts.flatMap((workout: Workout) => workout.sets)
    })


    return <ScrollView>
        <View style={{display: 'flex', flexDirection: 'row', flex: 1}}>
            <Card style={{margin: 5, flex: 1}}>
                <Card.Title title={<Text>Duration</Text>}></Card.Title>
                <Card.Content>
                    {formattedDifference && <Text>{formattedDifference}</Text>}
                    <Text>{totalTimeTraining.toISOString().substring(11, 19)}</Text>
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
        <WorkoutSetOverview trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts}/>
    </ScrollView>

}

export default MicroOverview;
