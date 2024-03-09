import {View} from "react-native";
import {Button} from "react-native-paper";
import React from "react";
import {dispatchSuggestBasedOnTrained} from "../redux/Training/dispatchSuggestBasedOnTrained";
import {dispatchSuggestBasedOnPlanned} from "../redux/Training/dispatchSuggestBasedOnPlanned";
import MicroOverview from "./MicroOverview";

interface TrainingsBaseProps {
    trainingsPlan: TrainingsPlan,
    trainingInMicro: number,
    micro: number
}

const TrainngsBase = ({trainingsPlan, trainingInMicro, micro}: TrainingsBaseProps) => {
    let suggestBasedOnTrained = dispatchSuggestBasedOnTrained(trainingsPlan.id!!, trainingInMicro);
    let suggestBasedOnPlanned = dispatchSuggestBasedOnPlanned(trainingsPlan.id!!, trainingInMicro);

    return <View>
        {suggestBasedOnPlanned && suggestBasedOnTrained && <View><Button
            onPress={() => suggestBasedOnTrained!!(trainingsPlan.id!!, micro, trainingInMicro)}>Suggest
            based on last Training</Button>
            <Button
                onPress={() => suggestBasedOnPlanned!!(trainingsPlan.id!!, micro, trainingInMicro)}>Suggest
                based on last planned Training</Button>
        </View>}
        {!suggestBasedOnPlanned && !suggestBasedOnTrained && <MicroOverview trainingsPlan={trainingsPlan}
                                                                            micro={micro}/>}
    </View>
}

export default TrainngsBase;
