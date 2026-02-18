import React, {useState} from 'react';
import {Range} from '../../components/picker/date/DateRangePicker';
import HistoryNode from '../../components/analyse/HistoryNode';
import TrainingElementPicker from '../../components/picker/elements/TrainingElementPicker';
import {Muscles} from '../../models/Muscles';
import {Exercise} from '../../models/entities/Exercise';
import RangeSwiper from '../../components/RangeSwiper';
import {firstDayOfWeek, lastDayOfWeek} from '../../utils/DateHelper';

const History = () => {
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const now = new Date();

  return (
    <RangeSwiper
      notSwipeableContent={<TrainingElementPicker exercise={exercise} setExercise={setExercise} muscle={muscle} setMuscle={setMuscle} />}
      nodeFunction={(range: Range, setRange: (range: Range) => void) => <HistoryNode range={range} setRange={setRange} exercise={exercise} muscle={muscle} />}
      determineValueByIndex={(index: number, range: Range) => {
        if (index === 0) {
          return range;
        }
        if (index === 1) {
          return range.plusOneRange();
        }
        if (index === -1) {
          return range.minusRange();
        }
        return range;
      }}
      startValue={new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0))}
    />
  );
};

export default History;
