import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, MD3Theme, Searchbar, Text, useTheme} from 'react-native-paper';
import {useSelector, useStore} from 'react-redux';
import {FlashList} from '@shopify/flash-list';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import SetSelectionModal from '../../components/video/SetSelectionModal';
import VideoAnalysisFiltersSection from '../../components/video/VideoAnalysisFiltersSection';
import VideoAnalysisListItem from '../../components/video/VideoAnalysisListItem';
import {Exercise} from '../../models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {dispatchDeleteVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchDeleteVideoAnalysis';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisMetersPerPixel} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel';
import {dispatchSetVideoAnalysisSeedPreflight} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight';
import {dispatchSetVideoAnalysisDuration} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisDuration';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {GlobalState} from '../../redux/rootReducer';
import {dispatchSetVideoAnalysisFiltersExpanded} from '../../redux/settings/dispatch/dispatchSetVideoAnalysisFiltersExpanded';
import {dispatchSetVideoAnalysisLearnedRate} from '../../redux/settings/dispatch/dispatchSetVideoAnalysisLearnedRate';
import {deleteVideoAnalysisArtifacts, getVideoAnalysisPreviewPath} from '../../utils/videoAnalysisStorage';
import {importVideoAnalysisFromSource} from '../../utils/video-analysis-import';
import {pickVideoFromGallery, releaseVideoUriPermission} from '../../utils/videoAnalysisNative';
import {isGalleryUriStillInUse} from '../../utils/videoAnalysisSource';
import {estimateAnalysisTimeMs} from '../../utils/videoAnalysisNotification';
import {calculateAnalysisProgress, DEFAULT_ANALYSIS_SECONDS_PER_VIDEO_SECOND} from '../../utils/videoAnalysisProgress';
import {buildVideoAnalysisDefaultDateRange, filterVideoAnalyses, filterVideoAnalysesBySearchQuery, isSameRange, RIR_PRESETS, VL_PRESETS} from '../../utils/video-analysis-filters';
import {
  buildVideoAnalysisFilterSummary,
  buildVideoAnalysisRangeFromPreset,
  getVideoAnalysisCountLabel,
  VideoAnalysisRangePreset,
} from '../../utils/video-analysis-presentation';

const ACTIVE_STATUSES = new Set([
  VideoAnalysisStatus.QUEUED,
  VideoAnalysisStatus.COPYING,
  VideoAnalysisStatus.PREFLIGHT,
  VideoAnalysisStatus.PROCESSING,
]);

// Module-level map so start times survive navigation (component unmount/remount).
const _analysisStartTimes = new Map<number, number>();

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
  });

const VideoAnalysisTab = () => {
  const navigation = useNavigation<any>();
  const store = useStore<GlobalState>();
  const analyses = useAllVideoAnalyses();
  const allExercises = useAlleExercises();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const setVideoAnalysisDuration = dispatchSetVideoAnalysisDuration();
  const removeVideoAnalysis = dispatchDeleteVideoAnalysis();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setSeedPreflight = dispatchSetVideoAnalysisSeedPreflight();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setMetersPerPixel = dispatchSetVideoAnalysisMetersPerPixel();
  const setFiltersExpanded = dispatchSetVideoAnalysisFiltersExpanded();
  const setVideoAnalysisLearnedRate = dispatchSetVideoAnalysisLearnedRate();
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const filtersExpanded = useSelector((state: GlobalState) => state.settings.videoAnalysisFiltersExpanded ?? false);
  const workoutsById = useSelector((state: GlobalState) => state.workouts.byId);

  const [importing, setImporting] = useState(false);
  const [linkSetForAnalysisId, setLinkSetForAnalysisId] = useState<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [filterExercise, setFilterExercise] = useState<Exercise[]>([]);
  const [selectedRangePreset, setSelectedRangePreset] = useState<VideoAnalysisRangePreset>('all');
  const defaultDateRange = useMemo(() => buildVideoAnalysisDefaultDateRange(analyses), [analyses]);
  const [dateRange, setDateRange] = useState(() => defaultDateRange);
  const [isDateRangeFilterActive, setIsDateRangeFilterActive] = useState(false);
  const [vlPresets, setVlPresets] = useState<Array<(typeof VL_PRESETS)[number]>>([]);
  const [rirPresets, setRirPresets] = useState<Array<(typeof RIR_PRESETS)[number]>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (params: Parameters<typeof Toast.show>[0]) => {
    if (!store.getState().settings?.toggles?.disableToasts) {
      Toast.show(params);
    }
  };

  const learnedSecondsPerVideoSecond = useSelector(
    (state: GlobalState) => state.settings.videoAnalysisLearnedRateSecondsPerVideoSecond ?? DEFAULT_ANALYSIS_SECONDS_PER_VIDEO_SECOND,
  );
  const nextAnalysisId = useMemo(() => (analyses.length > 0 ? Math.max(...analyses.map((analysis) => analysis.id ?? 0)) + 1 : 1), [analyses]);
  const exerciseOptions = useMemo(() => {
    const analysisExerciseIds = new Set(analyses.flatMap((analysis) => (analysis.exerciseId === undefined ? [] : [analysis.exerciseId])));
    return [...allExercises]
      .filter((exercise) => exercise.id !== undefined && analysisExerciseIds.has(exercise.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [allExercises, analyses]);
  const filterExerciseIds = useMemo(() => filterExercise.flatMap((exercise) => (exercise.id === undefined ? [] : [exercise.id])), [filterExercise]);
  const getSetRir = useCallback(
    (workoutId: number, setIndex: number): number | null => {
      const workout = workoutsById[workoutId];
      if (!workout) {
        return null;
      }
      const set = workout.sets.find((value) => value.index === setIndex);
      return set !== undefined ? set.rir : null;
    },
    [workoutsById],
  );

  const resolveExerciseName = useCallback(
    (analysis: {exerciseId?: number; workoutId?: number}): string | undefined => {
      const exerciseId = analysis.exerciseId ?? (analysis.workoutId !== undefined ? workoutsById[analysis.workoutId]?.exerciseId : undefined);
      return allExercises.find((e) => e.id === exerciseId)?.name;
    },
    [allExercises, workoutsById],
  );

  useEffect(() => {
    if (!isDateRangeFilterActive) {
      setDateRange(defaultDateRange);
      setSelectedRangePreset('all');
    }
  }, [defaultDateRange, isDateRangeFilterActive]);

  const activeCount = useMemo(() => analyses.filter((a) => ACTIVE_STATUSES.has(a.status)).length, [analyses]);

  useEffect(() => {
    if (activeCount === 0) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [activeCount]);

  useEffect(() => {
    const currentIds = new Set<number>();
    analyses.forEach((analysis) => {
      const analysisId = analysis.id;
      if (analysisId === undefined) {
        return;
      }
      currentIds.add(analysisId);
      if (ACTIVE_STATUSES.has(analysis.status)) {
        if (!_analysisStartTimes.has(analysisId)) {
          _analysisStartTimes.set(analysisId, new Date(analysis.createdAt).getTime());
        }
      } else {
        _analysisStartTimes.delete(analysisId);
      }
    });
    for (const id of _analysisStartTimes.keys()) {
      if (!currentIds.has(id)) {
        _analysisStartTimes.delete(id);
      }
    }
  }, [analyses]);

  const filteredAnalyses = useMemo(
    () =>
      filterVideoAnalyses({
        analyses,
        exerciseIds: filterExerciseIds,
        hasMuscleFilter: false,
        muscleExerciseIds: [],
        dateRange,
        isDateRangeFilterActive,
        vlPresets,
        rirPresets,
        getSetRir,
      }),
    [analyses, dateRange, filterExerciseIds, getSetRir, isDateRangeFilterActive, rirPresets, vlPresets],
  );

  const searchFilteredAnalyses = useMemo(
    () => filterVideoAnalysesBySearchQuery(filteredAnalyses, searchQuery, resolveExerciseName, getSetRir),
    [filteredAnalyses, getSetRir, resolveExerciseName, searchQuery],
  );

  const filterSummary = useMemo(
    () =>
      buildVideoAnalysisFilterSummary({
        analysesCount: analyses.length,
        selectedRangePreset,
        selectedExercises: filterExercise,
        vlPresets,
        rirPresets,
        defaultDateRange,
      }),
    [analyses.length, defaultDateRange, filterExercise, rirPresets, selectedRangePreset, vlPresets],
  );

  const importFromSource = async (sourceUri: string) => {
    try {
      const outcome = await importVideoAnalysisFromSource({
        analysisId: nextAnalysisId,
        sourceUri,
        addVideoAnalysis,
        setVideoAnalysisStatus,
        setVideoAnalysisDuration,
        setManualSeedFramePath,
        setSeedPreflight,
        attachVideoAnalysisResult,
        setMetersPerPixel,
        onRateUpdated: setVideoAnalysisLearnedRate,
      });

      if (outcome === 'analysis_started') {
        showToast({
          type: 'info',
          text1: 'Video analysis started',
          text2: 'Analysis is running in the background.',
          position: 'top',
        });
      } else if (outcome === 'awaiting_seed_selection') {
        showToast({
          type: 'info',
          text1: 'Seed selection required',
          text2: 'Open the analysis detail and choose the correct detected plate.',
          position: 'top',
        });
      } else if (outcome === 'failed_no_candidate') {
        showToast({
          type: 'error',
          text1: 'No plate candidate found',
          text2: 'No outer plate was detected at t=0. Try another clip.',
          position: 'top',
        });
      }
    } catch (_error) {
      showToast({
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
      // GH-321: the native picker takes a persistable read grant, so the gallery video
      // stays playable across app restarts without copying it into the app.
      const picked = await pickVideoFromGallery();
      if (!picked) {
        return;
      }
      await importFromSource(picked.uri);
    } catch (_error) {
      showToast({
        type: 'error',
        text1: 'Import failed',
        text2: 'Could not pick a video from the gallery.',
        position: 'top',
      });
    } finally {
      setImporting(false);
    }
  };

  const onDelete = useCallback(
    async (analysisId?: number, resultPath?: string, localVideoPath?: string, sourceUri?: string) => {
      if (analysisId === undefined) {
        return;
      }
      await deleteVideoAnalysisArtifacts({resultPath, localVideoPath, previewPath: getVideoAnalysisPreviewPath(analysisId)});
      // GH-321: the gallery grant is shared per URI, so only give it back once no other
      // analysis still points at the same source video — otherwise deleting one of two
      // analyses that reused the same clip would break playback for the survivor.
      if (!isGalleryUriStillInUse(sourceUri, analyses, analysisId)) {
        await releaseVideoUriPermission(sourceUri);
      }
      removeVideoAnalysis(analysisId);
    },
    [analyses, removeVideoAnalysis],
  );

  const onToggleExercise = useCallback((exercise: Exercise) => {
    setFilterExercise((previous) =>
      previous.some((selectedExercise) => selectedExercise.id === exercise.id)
        ? previous.filter((selectedExercise) => selectedExercise.id !== exercise.id)
        : [...previous, exercise],
    );
  }, []);

  const onSelectRangePreset = useCallback(
    (preset: VideoAnalysisRangePreset) => {
      setSelectedRangePreset(preset);

      if (preset === 'all') {
        setDateRange(defaultDateRange);
        setIsDateRangeFilterActive(false);
        return;
      }

      const nextRange = buildVideoAnalysisRangeFromPreset(preset);
      if (!nextRange) {
        setDateRange(defaultDateRange);
        setIsDateRangeFilterActive(false);
        return;
      }

      setDateRange(nextRange);
      setIsDateRangeFilterActive(!isSameRange(nextRange, defaultDateRange));
    },
    [defaultDateRange],
  );

  const renderHeader = useMemo(
    () => (
      <View style={styles.header}>
        <Searchbar
          placeholder="Search by exercise or RIR (e.g. Bench 1)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="video-analysis-search-bar"
          style={styles.searchBar}
        />
        <VideoAnalysisFiltersSection
          expanded={filtersExpanded}
          summary={filterSummary}
          selectedRangePreset={selectedRangePreset}
          selectedExercises={filterExercise}
          exerciseOptions={exerciseOptions}
          selectedVlPresets={vlPresets}
          selectedRirPresets={rirPresets}
          onToggleExpanded={() => setFiltersExpanded(!filtersExpanded)}
          onSelectRangePreset={onSelectRangePreset}
          onToggleExercise={onToggleExercise}
          onToggleVlPreset={(preset) => setVlPresets((previous) => (previous.includes(preset) ? previous.filter((value) => value !== preset) : [...previous, preset]))}
          onToggleRirPreset={(preset) => setRirPresets((previous) => (previous.includes(preset) ? previous.filter((value) => value !== preset) : [...previous, preset]))}
        />
        <View style={styles.importRow}>
          <Button testID="video-analysis-import-button" mode="contained" onPress={importFromGallery} loading={importing} disabled={importing} style={styles.importButton} contentStyle={styles.importButtonContent}>
            Import Video
          </Button>
          <Text variant="labelMedium" style={styles.countLabel} testID="video-analysis-lift-count">
            {getVideoAnalysisCountLabel(searchFilteredAnalyses.length)}
          </Text>
        </View>
      </View>
    ),
    [exerciseOptions, filterSummary, filterExercise, searchFilteredAnalyses.length, filtersExpanded, importFromGallery, importing, onSelectRangePreset, onToggleExercise, rirPresets, searchQuery, selectedRangePreset, setFiltersExpanded, vlPresets],
  );

  const renderAnalysisItem = useCallback(
    ({item}: {item: VideoAnalysis}) => {
      let progressProps: {elapsedMs: number; estimatedTotalMs: number; progress: number} | undefined;
      if (ACTIVE_STATUSES.has(item.status) && item.id !== undefined) {
        const startTime = _analysisStartTimes.get(item.id);
        const elapsedMs = startTime !== undefined ? Math.max(0, now - startTime) : 0;
        const estimatedTotalMs = estimateAnalysisTimeMs(item.videoMeta?.durationMs ?? 0, learnedSecondsPerVideoSecond);
        progressProps = {elapsedMs, estimatedTotalMs, progress: calculateAnalysisProgress(elapsedMs, estimatedTotalMs)};
      }
      return (
        <VideoAnalysisListItem
          analysis={item}
          onPress={() => {
            if (item.id !== undefined) {
              navigation.navigate({
                name: 'VideoAnalysisDetail',
                params: {analysisId: item.id},
              });
            }
          }}
          onLink={!item.workoutId && item.id !== undefined ? () => setLinkSetForAnalysisId(item.id) : undefined}
          onDelete={item.id !== undefined ? () => onDelete(item.id, item.resultPath, item.localVideoPath, item.sourceUri) : undefined}
          {...progressProps}
        />
      );
    },
    [navigation, now, learnedSecondsPerVideoSecond, onDelete],
  );

  const renderEmptyState = useMemo(
    () => (
      <Card style={styles.emptyCard} testID="video-analysis-empty-card">
        <Card.Content>
          <Text>{analyses.length === 0 ? 'No video analyses yet. Import your first training video.' : 'No analyses match the active filters.'}</Text>
        </Card.Content>
      </Card>
    ),
    [analyses.length],
  );

  return (
    <View style={[styles.container, themedStyles.background]} testID="video-analysis-screen">
      {linkSetForAnalysisId !== undefined && (
        <SetSelectionModal visible={true} onDismiss={() => setLinkSetForAnalysisId(undefined)} analysisId={linkSetForAnalysisId} onLinked={() => setLinkSetForAnalysisId(undefined)} />
      )}
      <FlashList
        data={searchFilteredAnalyses}
        renderItem={renderAnalysisItem}
        // FlashList rows are pure and ignore renderItem identity changes; the
        // ticking `now` must go through extraData or running-import progress
        // bars freeze after the first store-driven render (GH-343).
        extraData={now}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  importButton: {
    flex: 1,
  },
  importButtonContent: {
    minHeight: 40,
  },
  countLabel: {
    minWidth: 52,
    textAlign: 'right',
  },
  emptyCard: {
    marginHorizontal: 12,
    marginTop: 4,
  },
  searchBar: {
    elevation: 0,
  },
});

export default VideoAnalysisTab;
