import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import React, {useCallback, useEffect, useState} from 'react';
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
import {RecordsSelection} from '../../utils/RecordsAnalysis';

const RecordsTab = () => {
  let now = new Date(Date.now());
  const theme = useTheme();
  let exercises = useAlleExercises();
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.WEEK));
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)));
  // GH-617: the heatmap tile/bar whose records the list shows. Any change of the
  // range or the exercise/muscle/accumulation filter drops it.
  const [selection, setSelection] = useState<RecordsSelection | undefined>(undefined);
  const selectTile = useCallback((next?: RecordsSelection) => setSelection((current) => (next === undefined || current?.key === next.key ? undefined : next)), []);
  const showAll = useCallback(() => setSelection(undefined), []);
  const changeRange = useCallback((next: Range) => {
    setRange(next);
    setSelection(undefined);
  }, []);
  const changeExercise = useCallback((next: Exercise[]) => {
    setExercise(next);
    setSelection(undefined);
  }, []);
  const changeMuscle = useCallback((next: Muscles[]) => {
    setMuscle(next);
    setSelection(undefined);
  }, []);
  const changeAccumulation = useCallback((next: Accumulation | undefined) => {
    setAccumulation(next);
    setSelection(undefined);
  }, []);
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
  // The screen stays mounted while workouts are edited or deleted on other tabs. The list therefore
  // shows the current workout objects of the selection, and any change of which records exist (or of
  // their dates, which decide the tile) drops the selection so tile count and list cannot disagree.
  const recordsSignature = uniqueWorkouts
    .map((workout) => `${workout.id}:${workout.start ? new Date(workout.start).getTime() : ''}`)
    .sort()
    .join(',');
  useEffect(() => setSelection(undefined), [recordsSignature]);
  const selectedIds = selection ? new Set(selection.workouts.map((workout) => workout.id)) : undefined;
  const selectedWorkouts = selectedIds ? uniqueWorkouts.filter((workout) => selectedIds.has(workout.id)) : undefined;

  return (
    <ScrollView
      style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flex: 1,
      }}
    >
      {/* GH-617: starts collapsed to the "N selected" summary; the chevron shows the chips. */}
      <TrainingElementPicker
        exercise={exercise}
        setExercise={changeExercise}
        accumulation={accumulation}
        setAccumulation={changeAccumulation}
        muscle={muscle}
        setMuscle={changeMuscle}
        visible={false}
        collapseToSummary
      />
      <DateRangePicker range={range} setRange={changeRange} />
      <RecordsOverTimeCard
        recordWorkouts={uniqueWorkouts}
        exercises={exercises}
        rangeStart={range.startDate}
        rangeEnd={range.endDate}
        accumulation={accumulation}
        now={now}
        selectedKey={selection?.key}
        onSelect={selectTile}
      />
      <RecordCardList recordWorkouts={selectedWorkouts ?? uniqueWorkouts} exercises={exercises} filterTitle={selection?.title} onShowAll={showAll} />
      <View style={{height: 16}} />
    </ScrollView>
  );
};

export default RecordsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Records'>;
