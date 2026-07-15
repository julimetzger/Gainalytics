import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, IconButton, Text, useTheme} from 'react-native-paper';
import EditDialogScaffold from '../common/EditDialogScaffold';
import DropDown from 'react-native-paper-dropdown';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {Workout} from '../../models/entities/Workout';
import {WorkoutSet} from '../../models/entities/WorkoutSet';
import {Exercise} from '../../models/entities/Exercise';
import {dispatchLinkVideoAnalysisToWorkout} from '../../redux/VideoAnalysis/dispatch/dispatchLinkVideoAnalysisToWorkout';
import {getDateStringFromDate} from '../../utils/DateHelper';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  analysisId: number;
  onLinked?: () => void;
}

const SetSelectionModal = ({visible, onDismiss, analysisId, onLinked}: Props) => {
  const linkVideoAnalysis = dispatchLinkVideoAnalysisToWorkout();
  const theme = useTheme();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | undefined>(undefined);

  const workouts = useSelector((state: GlobalState) =>
    state.workouts.allIds
      .map(id => state.workouts.byId[id])
      .filter((w): w is Workout => !!w && !!w.id)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 30)
  );

  const exercises = useSelector((state: GlobalState) =>
    state.exercises.allIds.map(id => state.exercises.byId[id]).filter((e): e is Exercise => !!e)
  );

  const filteredWorkouts = selectedExerciseId !== undefined
    ? workouts.filter(w => w.exerciseId === selectedExerciseId)
    : workouts;

  const exerciseList = exercises.map(e => ({label: e.name, value: e.id!.toString()}));

  const onSelectSet = (workout: Workout, set: WorkoutSet) => {
    linkVideoAnalysis(analysisId, workout.id!, workout.exerciseId, set.index);
    onLinked?.();
    onDismiss();
  };

  const getExerciseName = (exerciseId: number) =>
    exercises.find(e => e.id === exerciseId)?.name ?? `Exercise ${exerciseId}`;

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title="Select a Set"
      testID="set-selection-modal"
      dismissTestID="set-selection-close"
      scrollable
    >
      <DropDown
        label="Filter by Exercise"
        mode="outlined"
        visible={dropdownVisible}
        onDismiss={() => setDropdownVisible(false)}
        showDropDown={() => setDropdownVisible(true)}
        value={selectedExerciseId?.toString() ?? ''}
        setValue={val => setSelectedExerciseId(val ? parseInt(val) : undefined)}
        list={[{label: 'All Exercises', value: ''}, ...exerciseList]}
        activeColor={theme.colors.primary}
      />
      <View style={styles.listContainer}>
        {filteredWorkouts.length === 0 && (
          <Text style={styles.emptyText}>No workouts found.</Text>
        )}
        {filteredWorkouts.map(workout => (
          <Card key={workout.id} style={styles.workoutCard}>
            <Card.Title
              title={getExerciseName(workout.exerciseId)}
              subtitle={workout.start ? getDateStringFromDate(new Date(workout.start)) : `Workout #${workout.id}`}
            />
            <Card.Content>
              {workout.sets.map(set => (
                <View
                  key={set.index}
                  style={styles.setRow}
                  testID={`set-selection-set-${workout.id}-${set.index}`}
                >
                  <Text style={styles.setText}>
                    {set.reps} reps × {set.weight} kg @ {set.rir} RIR
                  </Text>
                  <IconButton
                    icon="link"
                    size={18}
                    testID={`set-selection-link-${workout.id}-${set.index}`}
                    onPress={() => onSelectSet(workout, set)}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}
      </View>
    </EditDialogScaffold>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    marginTop: 10,
  },
  workoutCard: {
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  setText: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
  },
});

export default SetSelectionModal;
