import {ScrollView, View} from "react-native";
import {Card, Text} from "react-native-paper";
import React from "react";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import WorkoutSetOverview from "./WorkoutSetOverview";

interface TrainingsOverviewProps {
    training: Training,
    previousTraining: Training
}



const TrainingsOverview = ({training, previousTraining}: TrainingsOverviewProps) => {
    let trainingsWorkouts = useWorkoutsByIds(Object.values(training.doneWorkoutIds));
    let previousWorkouts = useWorkoutsByIds(previousTraining ? Object.values(previousTraining.doneWorkoutIds) : []);


    return (
        <ScrollView>
            <View><Text>Training completed, Markus approves. Heim gehen und gains abholen. Der
                Thunfischshake
                wartet
                auf dich! </Text>
                <Card>
                    <Card.Title title={<Text>Total Duration</Text>}></Card.Title>
                    <Card.Content>
                        <Text>{new Date(new Date(training.end!!).getTime() - new Date(training.start!!).getTime()).toISOString().substring(11, 19)}</Text>
                        <Text>{new Date(new Date(training.end!!).getTime() - new Date(training.start!!).getTime()).toISOString().substring(11, 19)}</Text>
                    </Card.Content>
                </Card>
                <WorkoutSetOverview trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts}/>
            </View>
        </ScrollView>
    );
}

export default TrainingsOverview;
