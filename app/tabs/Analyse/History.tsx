import React, {useState} from 'react';
import {Range} from "../../components/DateRangePicker";
import HistoryNode from "../../components/HistoryNode";
import Picker from "../../components/Picker";
import {Muscles} from "../../models/Muscles";
import {Exercise} from "../../models/Exercise";
import RangeSwiper from "../../components/RangeSwiper";


const History = () => {
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);

    return (
        <RangeSwiper
            notSwipeableContent={<Picker exercise={exercise} setExercise={setExercise} muscle={muscle}
                                         setMuscle={setMuscle}/>}
            nodeFunction={(range: Range, setRange: (range: Range) => void) => <HistoryNode
                range={range}
                setRange={setRange}
                exercise={exercise}
                muscle={muscle}/>}/>)
        ;
}

export default History;
