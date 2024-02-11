import React, {useState} from "react";
import {ScrollView} from "react-native";
import {Button} from "react-native-paper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {useAllTrainingsPlans} from "../../redux/Training/useTrainingsPlan";
import {useTrainingInTrainingsPlan} from "../../redux/Training/useTrainingInTrainingsPlan";
import {PlanTraining} from "./PlanTraining";

const TrainingsPlanTab = ({route}: Props) => {
    const trainingsPlan = useAllTrainingsPlans(route.params.trainingsPlan.id!!);
    const [micro, setMicro] = useState(1);
    const [trainingInMicro, setTrainingInMicro] = useState(1);
    const [planingMode, setPlaningMode] = useState(true);
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);


    return (
        <ScrollView>
            <Button onPress={() => setPlaningMode(!planingMode)}>
                Start Training
            </Button>
            {planingMode &&
                PlanTraining(training, trainingsPlan.id!!, micro, trainingInMicro)
            }
        </ScrollView>
    )
        ;
}
export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
