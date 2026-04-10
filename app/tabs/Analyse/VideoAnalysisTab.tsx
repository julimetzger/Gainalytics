import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, Chip, MD3Theme, Text, useTheme} from 'react-native-paper';
import DocumentPicker from 'react-native-document-picker';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchDeleteVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchDeleteVideoAnalysis';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisSeedPreflight} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import VideoAnalysisProgressBar from '../../components/video/VideoAnalysisProgressBar';
import {deleteVideoAnalysisArtifacts, getVideoAnalysisPreviewPath} from '../../utils/videoAnalysisStorage';
import {importVideoAnalysisFromSource} from '../../utils/video-analysis-import';
import {calculateAnalysisProgress, getLastAnalysisSecondsPerVideoSecond} from '../../utils/videoAnalysisProgress';
import {estimateAnalysisTimeMs} from '../../utils/videoAnalysisNotification';
import SetSelectionModal from '../../components/video/SetSelectionModal';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import TrainingElementPicker from '../../components/picker/elements/TrainingElementPicker';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {Exercise} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';
import {buildVideoAnalysisDefaultDateRange, filterVideoAnalyses, isSameRange, RIR_PRESETS, VL_PRESETS} from '../../utils/video-analysis-filters';

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

// Module-level map so start times survive navigation (component unmount/remount).
const _analysisStartTimes = new Map<number, number>();

const LinkedSetInfo = ({workoutId, exerciseId, setIndex}: {workoutId: number; exerciseId?: number; setIndex?: number}) => {
  const workout = useWorkoutById(workoutId);
  const exercise = useExercise(exerciseId);
  if (!workout || setIndex === undefined) {
    return null;
  }
  const set = workout.sets.find((s) => s.index === setIndex);
  if (!set) {
    return null;
  }
  const exerciseName = exercise?.name ?? 'Unknown';
  const label = `${exerciseName} \u2014 ${set.reps} reps \u00d7 ${set.weight} kg @ ${set.rir} RIR`;
  return (
    <Text testID={`video-analysis-linked-set-info`} style={{fontSize: 12, marginTop: 2}}>
      {label}
    </Text>
  );
};

const VideoAnalysisTab = () => {
  const navigation = useNavigation<any>();
  const analyses = useAllVideoAnalyses();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const removeVideoAnalysis = dispatchDeleteVideoAnalysis();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setSeedPreflight = dispatchSetVideoAnalysisSeedPreflight();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [importing, setImporting] = useState(false);
  const [linkSetForAnalysisId, setLinkSetForAnalysisId] = useState<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const learnedSecondsPerVideoSecond = useMemo(() => getLastAnalysisSecondsPerVideoSecond(), [analyses]);
  const nextAnalysisId = analyses.length > 0 ? Math.max(...analyses.map((item) => item.id ?? 0)) + 1 : 1;
  const processingCount = useMemo(() => analyses.filter((analysis) => analysis.status === VideoAnalysisStatus.PROCESSING).length, [analyses]);

  // Filter state
  const [filterExercise, setFilterExercise] = useState<Exercise[]>([]);
  const [filterMuscle, setFilterMuscle] = useState<Muscles[]>([]);
  const defaultDateRange = useMemo(() => buildVideoAnalysisDefaultDateRange(analyses), [analyses]);
  const [dateRange, setDateRange] = useState<Range>(() => defaultDateRange);
  const [isDateRangeFilterActive, setIsDateRangeFilterActive] = useState(false);
  const [vlPresets, setVlPresets] = useState<string[]>([]);
  const [rirPresets, setRirPresets] = useState<string[]>([]);
  const exercisesForMuscles = useExercisesForMuscles(filterMuscle);
  const filterExerciseIds = useMemo(() => filterExercise.flatMap((exercise) => (exercise.id === undefined ? [] : [exercise.id])), [filterExercise]);
  const muscleExerciseIds = useMemo(() => exercisesForMuscles.flatMap((exercise) => (exercise.id === undefined ? [] : [exercise.id])), [exercisesForMuscles]);

  // Refresh every 500ms while any analysis is in PROCESSING state so the
  // progress bar advances smoothly.
  useEffect(() => {
    if (processingCount === 0) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [processingCount]);

  useEffect(() => {
    analyses.forEach((analysis) => {
      const analysisId = analysis.id;
      if (analysisId === undefined) {
        return;
      }

      if (analysis.status === VideoAnalysisStatus.PROCESSING) {
        const persistedStartTime = new Date(analysis.createdAt).getTime();
        if (!_analysisStartTimes.has(analysisId)) {
          _analysisStartTimes.set(analysisId, persistedStartTime);
        }
        return;
      }

      _analysisStartTimes.delete(analysisId);
    });
  }, [analyses]);

  useEffect(() => {
    if (!isDateRangeFilterActive) {
      setDateRange(defaultDateRange);
    }
  }, [defaultDateRange, isDateRangeFilterActive]);

  const onDateRangeChange = useCallback(
    (nextRange: Range) => {
      setDateRange(nextRange);
      setIsDateRangeFilterActive(!isSameRange(nextRange, defaultDateRange));
    },
    [defaultDateRange],
  );

  const filteredAnalyses = useMemo(() => {
    return filterVideoAnalyses({
      analyses,
      exerciseIds: filterExerciseIds,
      hasMuscleFilter: filterMuscle.length > 0,
      muscleExerciseIds,
      dateRange,
      isDateRangeFilterActive,
      vlPresets,
      rirPresets,
    });
  }, [analyses, dateRange, filterExerciseIds, filterMuscle.length, isDateRangeFilterActive, muscleExerciseIds, rirPresets, vlPresets]);

  const importFromSource = async (sourceUri: string) => {
    try {
      const outcome = await importVideoAnalysisFromSource({
        analysisId: nextAnalysisId,
        sourceUri,
        addVideoAnalysis,
        setVideoAnalysisStatus,
        setManualSeedFramePath,
        setSeedPreflight,
        attachVideoAnalysisResult,
      });

      if (outcome === 'awaiting_seed_selection') {
        Toast.show({
          type: 'info',
          text1: 'Seed selection required',
          text2: 'Open the analysis detail and choose the correct detected plate.',
          position: 'top',
        });
      } else if (outcome === 'failed_no_candidate') {
        Toast.show({
          type: 'error',
          text1: 'No plate candidate found',
          text2: 'No outer plate was detected at t=0. Try another clip.',
          position: 'top',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Import failed',
        text2: 'Could not import or process the selected video.',
        position: 'top',
      });
    }
  };

  const importFromGallery = async () => {
    try {
      setImporting(true);
      const selectedVideo = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.video],
        copyTo: 'cachesDirectory',
      });
      const sourceUri = selectedVideo.fileCopyUri ?? selectedVideo.uri;
      await importFromSource(sourceUri);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Toast.show({
          type: 'error',
          text1: 'Import failed',
          text2: 'Could not pick a video from the gallery.',
          position: 'top',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (analysisId?: number, resultPath?: string, localVideoPath?: string) => {
    if (analysisId === undefined) {
      return;
    }
    await deleteVideoAnalysisArtifacts({resultPath, localVideoPath, previewPath: getVideoAnalysisPreviewPath(analysisId)});
    removeVideoAnalysis(analysisId);
  };

  return (
    <View style={[styles.container, themedStyles.background]} testID="video-analysis-screen">
      {linkSetForAnalysisId !== undefined && (
        <SetSelectionModal visible={true} onDismiss={() => setLinkSetForAnalysisId(undefined)} analysisId={linkSetForAnalysisId} onLinked={() => setLinkSetForAnalysisId(undefined)} />
      )}
      <TrainingElementPicker exercise={filterExercise} setExercise={setFilterExercise} muscle={filterMuscle} setMuscle={setFilterMuscle} style={styles.trainingElementPicker} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContent}>
        <Button testID="video-analysis-import-button" mode="contained" onPress={importFromGallery} loading={importing} disabled={importing} style={styles.importButton}>
          Import Video
        </Button>
        <View style={styles.datePickerRow}>
          <DateRangePicker range={dateRange} setRange={onDateRangeChange} />
        </View>
        <View style={styles.chipRow}>
          <Text variant="labelSmall" style={styles.chipLabel}>
            VL%
          </Text>
          {VL_PRESETS.map((preset) => (
            <Chip
              key={preset}
              testID={`video-analysis-vl-chip-${preset}`}
              selected={vlPresets.includes(preset)}
              onPress={() => setVlPresets((previous) => (previous.includes(preset) ? previous.filter((value) => value !== preset) : [...previous, preset]))}
              style={styles.chip}
              compact
            >
              {preset}
            </Chip>
          ))}
        </View>
        <View style={styles.chipRow}>
          <Text variant="labelSmall" style={styles.chipLabel}>
            RIR
          </Text>
          {RIR_PRESETS.map((preset) => (
            <Chip
              key={preset}
              testID={`video-analysis-rir-chip-${preset}`}
              selected={rirPresets.includes(preset)}
              onPress={() => setRirPresets((previous) => (previous.includes(preset) ? previous.filter((value) => value !== preset) : [...previous, preset]))}
              style={styles.chip}
              compact
            >
              {preset}
            </Chip>
          ))}
        </View>
        {filteredAnalyses.length === 0 && (
          <Card style={styles.card} testID="video-analysis-empty-card">
            <Card.Content>
              <Text>{analyses.length === 0 ? 'No video analyses yet. Import your first training video.' : 'No analyses match the active filters.'}</Text>
            </Card.Content>
          </Card>
        )}
        {filteredAnalyses.map((analysis) => {
          let progressBar: React.ReactNode = null;
          const analysisId = analysis.id;
          if (analysis.status === VideoAnalysisStatus.PROCESSING && analysisId !== undefined) {
            const startTime = _analysisStartTimes.get(analysisId);
            const elapsed = startTime !== undefined ? Math.max(0, now - startTime) : 0;
            const estimatedVideoDurationMs = analysis.videoMeta?.durationMs || 10_000;
            const estimated = estimateAnalysisTimeMs(estimatedVideoDurationMs, learnedSecondsPerVideoSecond);
            const progress = calculateAnalysisProgress(elapsed, estimated);
            progressBar = <VideoAnalysisProgressBar elapsedMs={elapsed} estimatedTotalMs={estimated} progress={progress} testID={`video-analysis-progress-${analysisId}`} />;
          }
          return (
            <Card key={analysisId} style={styles.card} testID={`video-analysis-card-${analysisId}`}>
              <Card.Title title={`Analysis #${analysisId}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
              <Card.Content>
                <Text testID={`video-analysis-status-${analysisId}`}>Status: {analysis.status}</Text>
                {analysis.workoutId !== undefined && <LinkedSetInfo workoutId={analysis.workoutId} exerciseId={analysis.exerciseId} setIndex={analysis.setIndex} />}
                {analysis.setResult && (
                  <Text testID={`video-analysis-set-summary-${analysisId}`} style={{fontSize: 12, marginTop: 4}}>
                    {analysis.setResult.repResults.length} reps
                    {analysis.setResult.velocityLossPercent !== null ? ` | VL ${analysis.setResult.velocityLossPercent}%` : ''}
                    {analysis.setResult.rirEstimate ? ` | RIR ${analysis.setResult.rirEstimate}` : ''}
                    {analysis.setResult.mean_path_deviation != null ? ` | Dev ${(analysis.setResult.mean_path_deviation * 100).toFixed(1)}%` : ''}
                    {analysis.setResult.path_deviation_slope != null ? ` | Slope ${(analysis.setResult.path_deviation_slope * 100).toFixed(2)}%/rep` : ''}
                  </Text>
                )}
                {progressBar}
                {analysis.error && <Text style={themedStyles.errorText}>Error: {analysis.error}</Text>}
              </Card.Content>
              <Card.Actions>
                <Button
                  testID={`video-analysis-open-${analysisId}`}
                  onPress={() => {
                    if (analysisId !== undefined) {
                      navigation.navigate({
                        name: 'VideoAnalysisDetail',
                        params: {analysisId},
                      });
                    }
                  }}
                >
                  Open
                </Button>
                {!analysis.workoutId && (
                  <Button testID={`video-analysis-link-set-${analysis.id}`} onPress={() => setLinkSetForAnalysisId(analysis.id)}>
                    Link
                  </Button>
                )}
                {analysis.workoutId && (
                  <Text testID={`video-analysis-linked-badge-${analysis.id}`} style={{fontSize: 12, color: theme.colors.secondary}}>
                    Linked
                  </Text>
                )}
                <Button testID={`video-analysis-delete-${analysis.id}`} textColor={theme.colors.error} onPress={() => onDelete(analysis.id, analysis.resultPath, analysis.localVideoPath)}>
                  Delete
                </Button>
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  trainingElementPicker: {
    marginHorizontal: 10,
    marginTop: 10,
  },
  importButton: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  datePickerRow: {
    marginHorizontal: 10,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 4,
    gap: 4,
  },
  chipLabel: {
    marginRight: 4,
    alignSelf: 'center',
  },
  chip: {
    marginRight: 2,
  },
});

export default VideoAnalysisTab;
