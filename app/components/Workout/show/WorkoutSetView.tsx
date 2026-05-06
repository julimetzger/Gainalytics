import {TouchableOpacity, View} from 'react-native';
import {DataTable, Icon, Text, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import AddWorkoutSet from '../add/AddWorkoutSet';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Metric} from "../../../models/Metric";

const WorkoutSetView = ({sets, onDelete, onSubmit, editable = true, highLightMode, onLinkVideo, linkedAnalyses, onVideoPress}: WorkoutSetViewProps) => {
  const theme = useTheme();
  const [setToUpdate, setSetToUpdate] = useState<WorkoutSet>();
  let indexOfSelectedWorkout = setToUpdate ? sets.indexOf(setToUpdate) : undefined;
  let workoutsBefore: WorkoutSet[] = [];
  let workoutsAfter: WorkoutSet[];
  if (indexOfSelectedWorkout !== undefined && indexOfSelectedWorkout !== -1) {
    workoutsBefore = sets.slice(0, indexOfSelectedWorkout);
    workoutsAfter = sets.slice(indexOfSelectedWorkout + 1);
  } else {
    workoutsAfter = sets;
  }
  useEffect(() => {}, [sets]);
  let highlightValue = (highLightMode && highLightMode !== Metric.FREQUENCY) ? calculateMetricValue(sets, highLightMode) : undefined;
  function showSets(set: WorkoutSet) {
    const linkedEntry = linkedAnalyses?.find(la => la.setIndex === set.index);
    const hasVl = linkedEntry?.vlPercent != null;
    const hasDrift = linkedEntry?.drift != null;
    const rowKey = set.index!! + set.reps + set.rir + set.weight + (set.date ? new Date(set.date).getTime().toString() : '');
    return (
      <React.Fragment key={rowKey}>
        <DataTable.Row
          style={{minHeight: 35}}
          onPress={() => {
            if (editable) {
              setSetToUpdate(set);
            }
          }}
        >
          <DataTable.Cell style={{flex: 6}}>{set.reps + ' reps'}</DataTable.Cell>
          <DataTable.Cell style={{flex: 6}}>{set.rir + ' RIR'}</DataTable.Cell>
          <DataTable.Cell style={{flex: 6}}>{set.weight + ' kg'}</DataTable.Cell>
          <DataTable.Cell style={{flex: 1}}>
            {highLightMode && (highLightMode === Metric.MAX_INTENSITY || highLightMode === Metric.ONE_RM) && highlightValue === calculateMetricValue([set], highLightMode) ? (
              <Icon size={15} source={'trophy'} color={theme.colors.primary} />
            ) : null}
          </DataTable.Cell>
          <DataTable.Cell style={{flex: 1}}>
            {linkedEntry ? (
              <TouchableOpacity
                testID={`set-linked-video-${set.index}`}
                accessible={true}
                onPress={() => onVideoPress && onVideoPress(linkedEntry.analysisId)}
                style={{padding: 2}}
              >
                <Icon size={15} source={'video'} color={theme.colors.secondary} />
              </TouchableOpacity>
            ) : null}
            {!linkedEntry && editable && onLinkVideo ? (
              <TouchableOpacity
                testID={`set-link-video-${set.index}`}
                accessible={true}
                onPress={() => onLinkVideo(set)}
                style={{padding: 2}}
              >
                <Icon source="video-plus" size={16} />
              </TouchableOpacity>
            ) : null}
          </DataTable.Cell>
        </DataTable.Row>
        {(hasVl || hasDrift) && (
          <View
            testID={`set-video-metrics-${set.index}`}
            style={{flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 4, gap: 16}}
          >
            {hasVl && (
              <Text
                testID={`set-vl-${set.index}`}
                variant="labelSmall"
                style={{color: linkedEntry!.vlPercent! >= 30 ? theme.colors.error : theme.colors.secondary}}
              >
                {'VL ' + Math.round(linkedEntry!.vlPercent!) + '%'}
              </Text>
            )}
            {hasDrift && (
              <Text
                testID={`set-drift-${set.index}`}
                variant="labelSmall"
                style={{color: theme.colors.tertiary}}
              >
                {'Drift ' + (Math.round(linkedEntry!.drift! * 1000) / 10) + '%'}
              </Text>
            )}
          </View>
        )}
      </React.Fragment>
    );
  }

  return (
    <View>
      {workoutsBefore.map(showSets)}
      {setToUpdate && (
        <AddWorkoutSet
          onSubmit={(arg) => {
            onSubmit!!(arg);
            setSetToUpdate(undefined);
          }}
          onDelete={(workout) => {
            onDelete!!(workout);
            setSetToUpdate(undefined);
          }}
          workoutSet={setToUpdate}
          hasToSaveManually={true}
        />
      )}
      {workoutsAfter.map(showSets)}
    </View>
  );
};

interface LinkedAnalysisEntry {
  setIndex: number;
  analysisId: number;
  vlPercent?: number | null;
  drift?: number | null;
}

interface WorkoutSetViewProps {
  sets: WorkoutSet[];
  onDelete?: (workoutSet: WorkoutSet) => void;
  onSubmit?: (workoutSet: WorkoutSet) => void;
  editable?: boolean;
  highLightMode?: Metric;
  onLinkVideo?: (set: WorkoutSet) => void;
  linkedAnalyses?: LinkedAnalysisEntry[];
  onVideoPress?: (analysisId: number) => void;
}

export default WorkoutSetView;
