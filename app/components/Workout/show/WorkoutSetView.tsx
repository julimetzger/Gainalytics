import {TouchableOpacity, View} from 'react-native';
import {DataTable, Divider, Icon, Text, useTheme} from 'react-native-paper';
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
    // Fix 3: prefer DONE analysis (has vlPercent/drift) over queued/failed for the same set
    const linkedEntry = linkedAnalyses?.find(la => la.setIndex === set.index && (la.vlPercent != null || la.drift != null))
      ?? linkedAnalyses?.find(la => la.setIndex === set.index);
    const hasVl = linkedEntry?.vlPercent != null;
    const hasDrift = linkedEntry?.drift != null;
    const hasMetrics = hasVl || hasDrift;
    const rowKey = set.index!! + set.reps + set.rir + set.weight + (set.date ? new Date(set.date).getTime().toString() : '');
    return (
      <React.Fragment key={rowKey}>
        {/* Fix 1: suppress the row's own bottom border when metrics follow; Divider renders after metrics instead */}
        <DataTable.Row
          style={{minHeight: 35, ...(hasMetrics ? {borderBottomWidth: 0} : {})}}
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
          {/* Fix 2: always render an icon — video when linked, video-plus when not */}
          <DataTable.Cell style={{flex: 2}}>
            {linkedEntry ? (
              <TouchableOpacity
                testID={`set-linked-video-${set.index}`}
                accessible={true}
                onPress={() => onVideoPress && onVideoPress(linkedEntry.analysisId)}
                style={{padding: 2}}
              >
                <Icon size={15} source={'video'} color={theme.colors.secondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID={`set-link-video-${set.index}`}
                accessible={true}
                onPress={editable && onLinkVideo ? () => onLinkVideo(set) : undefined}
                style={{padding: 2, opacity: editable && onLinkVideo ? 1 : 0.35}}
              >
                <Icon source="video-plus" size={16} />
              </TouchableOpacity>
            )}
          </DataTable.Cell>
        </DataTable.Row>
        {hasMetrics && (
          <>
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
            <Divider testID={`set-metrics-divider-${set.index}`} />
          </>
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
