import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import React, {useState} from "react";
import TrainingElementPicker from "../../components/picker/elements/TrainingElementPicker";
import {Range} from "../../components/picker/date/DateRangePicker";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import RangeSwiper from "../../components/RangeSwiper";
import {firstDayOfWeek, lastDayOfWeek} from "../../utils/DateHelper";
import MetricsNode from "../../components/analyse/MetricsNode";

const MetricsTab = () => {
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);
    const now = new Date();

    return (
        <RangeSwiper
            notSwipeableContent={<TrainingElementPicker exercise={exercise} setExercise={setExercise} muscle={muscle}
                                                        setMuscle={setMuscle}/>}
            nodeFunction={(range: Range, setRange: (range: Range) => void) => <MetricsNode
                range={range}
                setRange={setRange}
                exercise={exercise}
                muscle={muscle}/>}
            determineValueByIndex={(index: number, range: Range) => {
                if (index === 0) {
                    return range
                }
                if (index === 1) {
                    return range.plusOneRange()
                }
                if (index === -1) {
                    return range.minusRange()
                }
                return range
            }}
            startValue={new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0))}
        />)
}

export default MetricsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Metrics'>;
