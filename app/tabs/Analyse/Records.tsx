import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import React, {useState} from 'react';
import TrainingElementPicker, {Accumulation} from '../../components/picker/elements/TrainingElementPicker';
import {ScrollView, View} from 'react-native';
import {Exercise, Record} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../models/entities/Workout';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {useTheme} from 'react-native-paper';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {AccumulationMode} from '../../models/AccumulationMode';
import RecordsOverTimeCard from '../../components/analyse/records/RecordsOverTimeCard';
import RecordCardList from '../../components/analyse/records/RecordCardList';

const RecordsTab = () => {
  let now = new Date(Date.now());
  const theme = useTheme();
  let exercises = useAlleExercises();
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.WEEK));
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)));
  let exercisesForMuscles = useExercisesForMuscles(muscle);
  let exerciseIDs = exercise.map((it) => it.id);
  let exercisesForMusclesIds = exercisesForMuscles.map((it) => it.id);
  // Some imported workouts carry an empty records map — only workouts with an
  // actual 1RM record count as records on this page.
  let allWorkouts = useWorkoutsIn(range).filter((workout: Workout) => Number.isFinite(Number(workout.records?.[Record.ONE_RM])));
  let workoutsForExercise = allWorkouts.filter((workout: Workout) => (exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : muscle.length <= 0)) as Workout[];
  let workoutsForMuscles = allWorkouts.filter((workout: Workout) =>
    exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : exercise.length <= 0,
  ) as Workout[];
  let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
  let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map((workout) => workout.id))).map((id) => combinedWorkouts.find((workout) => workout.id === id)!!);

  return (
    <ScrollView
      style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flex: 1,
      }}
    >
      <TrainingElementPicker exercise={exercise} setExercise={setExercise} accumulation={accumulation} setAccumulation={setAccumulation} muscle={muscle} setMuscle={setMuscle} />
      <DateRangePicker range={range} setRange={setRange} />
      <RecordsOverTimeCard recordWorkouts={uniqueWorkouts} exercises={exercises} rangeStart={range.startDate} rangeEnd={range.endDate} accumulation={accumulation} now={now} />
      <RecordCardList recordWorkouts={uniqueWorkouts} exercises={exercises} />
      <View style={{height: 16}} />
    </ScrollView>
  );
};

export default RecordsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Records'>;
