import {View} from "react-native";
import {Button} from "react-native-paper";
import React from "react";
import {dispatchSuggestBasedOnTrained} from "../../redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained";
import {dispatchSuggestBasedOnPlanned} from "../../redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned";
import {TrainingsPlan} from "../../models/TrainingsPlan";

interface TrainingsBaseProps {
    trainingsPlan: TrainingsPlan,
    trainingInMicro: number,
    micro: number
}

const TrainingsBase = ({trainingsPlan, trainingInMicro, micro}: TrainingsBaseProps) => {
    let suggestBasedOnTrained = dispatchSuggestBasedOnTrained(trainingsPlan.id!!, trainingInMicro);
    let suggestBasedOnPlanned = dispatchSuggestBasedOnPlanned(trainingsPlan.id!!, trainingInMicro);

    return <View>
        <View style={{margin: 5}}>
            <Button disabled={suggestBasedOnTrained === undefined}
                    onPress={() => suggestBasedOnTrained!!(trainingsPlan.id!!, micro, trainingInMicro)}>
                    Suggest based on last Training
            </Button>
            <Button disabled={suggestBasedOnPlanned === undefined}
                    onPress={() => suggestBasedOnPlanned!!(trainingsPlan.id!!, micro, trainingInMicro)}>
                    Suggest based on last planned Training
            </Button>
        </View>
    </View>
}

export default TrainingsBase;
