import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import React, {useState} from "react";
import Picker from "../../components/Picker";
import {Range} from "../../components/DateRangePicker";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import MetricsNode from "../../components/MetricsNode";
import RangeSwiper from "../../components/RangeSwiper";

const MetricsTab = () => {
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);

    return (
        <RangeSwiper
            notSwipeableContent={<Picker exercise={exercise} setExercise={setExercise} muscle={muscle}
                                         setMuscle={setMuscle}/>}
            nodeFunction={(range: Range, setRange: (range: Range) => void) => <MetricsNode
                range={range} setRange={setRange} muscle={muscle}
                exercise={exercise}/>}/>
    )
}

export default MetricsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Metrics'>;
