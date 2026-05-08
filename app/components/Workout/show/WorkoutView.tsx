import React, {memo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, IconButton, Text, useTheme} from 'react-native-paper';
import OutsidePressHandler from 'react-native-outside-press';
import AddWorkoutSet from '../add/AddWorkoutSet';
import WorkoutSetView from './WorkoutSetView';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import dispatchDeleteWorkout from '../../../redux/Workout/dispatch/dispatchDeleteWorkout';
import {useWorkoutById} from '../../../redux/Workout/use/useWorkoutById';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {Metric} from "../../../models/Metric";
import {useSelector} from 'react-redux';
import {GlobalState} from '../../../redux/rootReducer';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import VideoSelectionModal from '../../video/VideoSelectionModal';
import {useNavigation} from '@react-navigation/native';
import {VideoAnalysisStatus} from '../../../models/entities/VideoAnalysis';

const useOptionalNavigation = () => {
  try {
    return useNavigation<any>();
  } catch {
    return null;
  }
};

interface WorkoutViewTileProps {
  workoutId: number;
  highlightMode?: Metric;
  editable?: boolean;
}

const WorkoutView = ({workoutId, highlightMode, editable}: WorkoutViewTileProps) => {
  const theme = useTheme();
  const navigation = useOptionalNavigation();
  const [showEdit, setShowEdit] = useState(false);
  const [linkVideoSet, setLinkVideoSet] = useState<WorkoutSet | undefined>(undefined);

  const workout = useWorkoutById(workoutId);
  const userExercise = useExercise(workout?.exerciseId);
  const deleteWorkout = dispatchDeleteWorkout();
  const deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  const addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(userExercise);

  const linkedAnalyses = useSelector((state: GlobalState) =>
    state.videoAnalyses.allIds
      .map(id => state.videoAnalyses.byId[id])
      .filter(a => a.workoutId === workoutId && a.setIndex !== undefined && a.id !== undefined)
      .map(a => ({
        setIndex: a.setIndex as number,
        analysisId: a.id as number,
        vlPercent: a.status === VideoAnalysisStatus.DONE ? a.setResult?.velocityLossPercent : undefined,
        drift: a.status === VideoAnalysisStatus.DONE ? a.setResult?.mean_path_deviation : undefined,
      }))
  );

  const setShowEditWhenEditable = (shouldShow: boolean) => {
    if (editable) {
      setShowEdit(shouldShow);
    }
  };

  const effectiveHighlightMode = highlightMode || (workout?.records && (Object.keys(workout.records).pop() as keyof typeof Metric));

  return (
    <View>
      {linkVideoSet !== undefined && workout?.id !== undefined && (
        <VideoSelectionModal
          visible={true}
          onDismiss={() => setLinkVideoSet(undefined)}
          workoutId={workout.id}
          setIndex={linkVideoSet.index ?? 0}
          exerciseId={workout.exerciseId}
          onLinked={() => setLinkVideoSet(undefined)}
        />
      )}
      {editable ? (
        <OutsidePressHandler onOutsidePress={() => setShowEditWhenEditable(false)} key={workout.id}>
          <Card mode="outlined" style={styles.card} onLongPress={() => setShowEditWhenEditable(true)} key={workout.id}>
            <View style={styles.exercise}>
              <Text style={[styles.title, {fontSize: theme.fonts.titleMedium.fontSize}]}>{userExercise.name}</Text>
              {showEdit && (
                <IconButton
                  style={styles.deleteIcon}
                  icon="delete"
                  onPress={() => {
                    deleteWorkout(workout);
                    setShowEdit(false);
                  }}
                />
              )}
            </View>

            {showEdit && <AddWorkoutSet onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)} />}

            <WorkoutSetView
              key={workout.id}
              sets={workout.sets}
              onDelete={(workoutSet) => deleteSetFromWorkout(workoutSet, workout)}
              onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)}
              highLightMode={effectiveHighlightMode}
              editable={editable}
              onLinkVideo={showEdit ? (set) => setLinkVideoSet(set) : undefined}
              linkedAnalyses={linkedAnalyses}
              onVideoPress={navigation ? (analysisId) => navigation.navigate('VideoAnalysisDetail', {analysisId}) : undefined}
            />
          </Card>
        </OutsidePressHandler>
      ) : (
        <Card mode="outlined" style={styles.card} onLongPress={() => setShowEditWhenEditable(true)} key={workout.id}>
          <View style={styles.exercise}>
            <Text style={[styles.title, {fontSize: theme.fonts.titleMedium.fontSize}]}>{userExercise.name}</Text>
            {showEdit && (
              <IconButton
                style={styles.deleteIcon}
                icon="delete"
                onPress={() => {
                  deleteWorkout(workout);
                  setShowEdit(false);
                }}
              />
            )}
          </View>

          {showEdit && <AddWorkoutSet onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)} />}

          <WorkoutSetView
            key={workout.id}
            sets={workout.sets}
            onDelete={(workoutSet) => deleteSetFromWorkout(workoutSet, workout)}
            onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)}
            highLightMode={effectiveHighlightMode}
            editable={editable}
            linkedAnalyses={linkedAnalyses}
            onVideoPress={navigation ? (analysisId) => navigation.navigate('VideoAnalysisDetail', {analysisId}) : undefined}
          />
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  exercise: {
    flex: 1,
    flexDirection: 'row',
  },
  title: {
    marginLeft: 10,
  },
  deleteIcon: {
    margin: 0,
    height: 25,
  },
});

export default memo(WorkoutView, (prevProps, nextProps) => {
  return prevProps.workoutId === nextProps.workoutId && prevProps.highlightMode === nextProps.highlightMode && prevProps.editable === nextProps.editable;
});
