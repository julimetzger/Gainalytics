import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {useSharedValue} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import {migrateBarTrackingResultIfNeeded} from '../../utils/videoAnalysisNative';
import {resolveVideoPlaybackUri} from '../../utils/videoAnalysisSource';
import {aggregateSetVelocity, resolveCompareRepResults} from '../../utils/videoAnalysisSetAggregates';
import CompareSyncPlaybackCard, {CompareSyncMode, CompareSyncPlaybackHandle} from '../../components/video/CompareSyncPlaybackCard';
import {computeAutoOffsetMs} from '../../utils/compareSync';
import CompareHeaderCard from '../../components/video/CompareHeaderCard';
import VelocityCompareChart from '../../components/video/VelocityCompareChart';
import BarPathCompareView from '../../components/video/BarPathCompareView';
import CompareRepSummary from '../../components/video/CompareRepSummary';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisCompare'> {}

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
  });

const VideoAnalysisCompareTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  // The screen can be opened from the Analyse drawer without params; fall
  // through to the "not found" message instead of crashing on undefined.
  const {analysisId, compareAnalysisId} = route.params ?? ({} as Partial<RootStackParamList['VideoAnalysisCompare']>);

  const analysis1 = useVideoAnalysis(analysisId);
  const analysis2 = useVideoAnalysis(compareAnalysisId);

  const [result1, setResult1] = useState<BarTrackingResult | undefined>();
  const [result2, setResult2] = useState<BarTrackingResult | undefined>();

  // Shared-timeline sync state. The effective offset maps timeline time to
  // video B time (videoBTime = timelineTime + offsetB).
  const [syncMode, setSyncMode] = useState<CompareSyncMode>('auto');
  const [manualOffsetMs, setManualOffsetMs] = useState(0);
  const [timelineDurationMs, setTimelineDurationMs] = useState(1);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>(undefined);
  const timelineTimeSV = useSharedValue(0);
  const syncCardRef = useRef<CompareSyncPlaybackHandle>(null);

  const autoOffsetMs = useMemo(
    () => computeAutoOffsetMs(result1?.repSegments, result2?.repSegments),
    [result1, result2],
  );
  const offsetBMs = syncMode === 'auto' ? autoOffsetMs : manualOffsetMs;

  // Entering manual mode starts from the current alignment, so the videos do
  // not jump; the regulator then shifts B relative to A from there.
  const handleSyncModeChange = useCallback(
    (mode: CompareSyncMode) => {
      if (mode === 'manual') {
        setManualOffsetMs(offsetBMs);
      }
      setSyncMode(mode);
    },
    [offsetBMs],
  );

  // Load result for analysis 1
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!analysis1?.resultPath || analysis1.status !== VideoAnalysisStatus.DONE) {
        if (active) {
          setResult1(undefined);
        }
        return;
      }
      const migratedPath = await migrateBarTrackingResultIfNeeded(analysis1.resultPath);
      const loaded = await readBarTrackingResultFromFile(migratedPath ?? analysis1.resultPath);
      if (active) {
        setResult1(loaded);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [analysis1?.id, analysis1?.localVideoPath, analysis1?.resultPath, analysis1?.status]);

  // Load result for analysis 2
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!analysis2?.resultPath || analysis2.status !== VideoAnalysisStatus.DONE) {
        if (active) {
          setResult2(undefined);
        }
        return;
      }
      const migratedPath = await migrateBarTrackingResultIfNeeded(analysis2.resultPath);
      const loaded = await readBarTrackingResultFromFile(migratedPath ?? analysis2.resultPath);
      if (active) {
        setResult2(loaded);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [analysis2?.id, analysis2?.localVideoPath, analysis2?.resultPath, analysis2?.status]);

  const seekTimeline = useCallback((timelineMs: number) => {
    syncCardRef.current?.seekToTimelineMs(timelineMs);
  }, []);

  // Tap on a rep row moves the shared scrubber to that rep's lift-off on the
  // timeline; both videos jump together via the shared seek.
  const handleRepPress = useCallback(
    (repIndex: number) => {
      const segment = result1?.repSegments[repIndex];
      if (segment) {
        seekTimeline(segment.startMs);
      }
    },
    [result1, seekTimeline],
  );

  // Per-rep velocities: prefer the calibrated saved setResult, otherwise
  // compute real values from the tracking data — never all-zero rows.
  const repResults1 = useMemo(() => resolveCompareRepResults(result1, analysis1?.setResult), [result1, analysis1?.setResult]);
  const repResults2 = useMemo(() => resolveCompareRepResults(result2, analysis2?.setResult), [result2, analysis2?.setResult]);

  const aggregate1 = useMemo(() => aggregateSetVelocity(repResults1), [repResults1]);
  const aggregate2 = useMemo(() => aggregateSetVelocity(repResults2), [repResults2]);

  const metersPerPixel1 = analysis1?.metersPerPixel ?? result1?.analysisMeta.metersPerPixel;
  const metersPerPixel2 = analysis2?.metersPerPixel ?? result2?.analysisMeta.metersPerPixel;

  if (!analysis1 || !analysis2) {
    return (
      <View style={[styles.centered, themedStyles.background]}>
        <Text>One or both analyses not found.</Text>
      </View>
    );
  }

  const videoUriA = resolveVideoPlaybackUri(analysis1);
  const videoUriB = resolveVideoPlaybackUri(analysis2);
  const hasVideos = !!(videoUriA && videoUriB);
  const hasResults = !!(result1 && result2);

  return (
    <ScrollView
      style={[styles.container, themedStyles.background]}
      contentInsetAdjustmentBehavior="automatic"
      testID="video-analysis-compare-screen"
    >
      {/* KPI header: exercise, load × reps, date, set-aggregated Mean/Peak velocity + Δ */}
      <CompareHeaderCard
        analysisA={analysis1}
        analysisB={analysis2}
        aggregateA={aggregate1}
        aggregateB={aggregate2}
        metersPerPixelA={metersPerPixel1}
        metersPerPixelB={metersPerPixel2}
      />

      {/* Synchronized playback: shared scrubber + transport for both videos */}
      {hasVideos && hasResults && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Synchronized Playback" />
            <Card.Content>
              <CompareSyncPlaybackCard
                ref={syncCardRef}
                videoPathA={videoUriA!}
                videoPathB={videoUriB!}
                resultA={result1!}
                resultB={result2!}
                offsetBMs={offsetBMs}
                autoOffsetMs={autoOffsetMs}
                syncMode={syncMode}
                onSyncModeChange={handleSyncModeChange}
                onManualOffsetChange={setManualOffsetMs}
                timelineTimeSV={timelineTimeSV}
                onTimelineDurationChange={setTimelineDurationMs}
                onCurrentRepChange={setCurrentRepIndex}
              />
            </Card.Content>
          </Card>
        </>
      )}

      {/* Velocity overlay chart */}
      {hasResults && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Velocity Overlay" subtitle="tap to jump" />
            <Card.Content>
              <VelocityCompareChart
                barPathSeries1={result1!.barPathSeries}
                barPathSeries2={result2!.barPathSeries}
                height={220}
                timeOffset2Ms={offsetBMs}
                timelineDurationMs={timelineDurationMs}
                onSeekTimeline={seekTimeline}
                progressSV={timelineTimeSV}
              />
            </Card.Content>
          </Card>
        </>
      )}

      {/* Bar path overlay */}
      {hasResults && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Bar Path Overlay" />
            <Card.Content>
              <BarPathCompareView
                barPathSeries1={result1!.barPathSeries}
                barPathSeries2={result2!.barPathSeries}
                height={220}
              />
            </Card.Content>
          </Card>
        </>
      )}

      {/* Rep comparison table */}
      {hasResults && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Rep Comparison" subtitle="tap a rep to jump" />
            <Card.Content>
              <CompareRepSummary
                repResults1={repResults1}
                repResults2={repResults2}
                metersPerPixel1={metersPerPixel1}
                metersPerPixel2={metersPerPixel2}
                onRepPress={handleRepPress}
                highlightedRepIndex={currentRepIndex}
              />
            </Card.Content>
          </Card>
        </>
      )}

      {!hasResults && (
        <Card style={styles.card}>
          <Card.Content>
            <Text testID="compare-no-results-text">
              {analysis1.status !== VideoAnalysisStatus.DONE
                ? `Analysis A is not done (status: ${analysis1.status}).`
                : analysis2.status !== VideoAnalysisStatus.DONE
                ? `Analysis B is not done (status: ${analysis2.status}).`
                : 'Loading analysis results...'}
            </Text>
          </Card.Content>
        </Card>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 10,
  },
  divider: {
    marginHorizontal: 10,
    marginVertical: 4,
  },
  bottomSpacer: {
    height: 24,
  },
});

export default VideoAnalysisCompareTab;
