import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, Divider, IconButton, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import {attachVideoRotationToResult, migrateBarTrackingResultIfNeeded} from '../../utils/videoAnalysisNative';
import VideoAnalysisPlayerView, {VideoPlayerLoadEvent, VideoPlayerProgressEvent} from '../../components/video/VideoAnalysisPlayerView';
import {computeRepPhaseTimesMs} from '../../components/video/VideoAnalysisPlaybackOverlayCard';
import VelocityCompareChart from '../../components/video/VelocityCompareChart';
import BarPathCompareView from '../../components/video/BarPathCompareView';
import CompareRepSummary from '../../components/video/CompareRepSummary';
import {processColor} from 'react-native';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisCompare'> {}

/** Pure helper — exported for unit testing. */
export function computeRepSeekPositions(
  result1: Pick<BarTrackingResult, 'repSegments'>,
  result2: Pick<BarTrackingResult, 'repSegments'> | undefined,
  repIndex: number,
): {seekMs1: number; seekMs2: number} | null {
  const seg1 = result1.repSegments[repIndex];
  if (!seg1) {
    return null;
  }
  const seg2 = result2?.repSegments[repIndex];
  return {
    seekMs1: seg1.startMs,
    // Fall back to seg1 time only when result2 has no segment at this index
    seekMs2: seg2 ? seg2.startMs : seg1.startMs,
  };
}

const DEFAULT_ASPECT_RATIO = 16 / 9;

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    labelA: {
      color: theme.colors.primary,
    },
    labelB: {
      color: theme.colors.error,
    },
    videoContainerA: {
      borderColor: theme.colors.primary,
    },
    videoContainerB: {
      borderColor: theme.colors.error,
    },
    controlsBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
  });

const VideoAnalysisCompareTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const {analysisId, compareAnalysisId} = route.params;

  const analysis1 = useVideoAnalysis(analysisId);
  const analysis2 = useVideoAnalysis(compareAnalysisId);

  const [result1, setResult1] = useState<BarTrackingResult | undefined>();
  const [result2, setResult2] = useState<BarTrackingResult | undefined>();

  const [paused, setPaused] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [seekMs1, setSeekMs1] = useState<number | undefined>(undefined);
  const [seekMs2, setSeekMs2] = useState<number | undefined>(undefined);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>(undefined);

  const [duration1Ms, setDuration1Ms] = useState(0);
  const [duration2Ms, setDuration2Ms] = useState(0);
  const [aspectRatio1, setAspectRatio1] = useState(DEFAULT_ASPECT_RATIO);
  const [aspectRatio2, setAspectRatio2] = useState(DEFAULT_ASPECT_RATIO);

  const primaryColor1 = useMemo(
    () => (processColor(theme.colors.primary) ?? undefined) as number | undefined,
    [theme],
  );
  const primaryColor2 = useMemo(
    () => (processColor(theme.colors.error) ?? undefined) as number | undefined,
    [theme],
  );
  const pathColor = useMemo(
    () => (processColor(theme.colors.outline) ?? undefined) as number | undefined,
    [theme],
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
      const withRotation = await attachVideoRotationToResult(loaded, analysis1.localVideoPath);
      if (active) {
        setResult1(withRotation);
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
      const withRotation = await attachVideoRotationToResult(loaded, analysis2.localVideoPath);
      if (active) {
        setResult2(withRotation);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [analysis2?.id, analysis2?.localVideoPath, analysis2?.resultPath, analysis2?.status]);

  const handleLoad1 = useCallback((event: {nativeEvent: VideoPlayerLoadEvent}) => {
    const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
    setDuration1Ms(durationMs);
    if (videoWidth > 0 && videoHeight > 0) {
      setAspectRatio1(videoWidth / videoHeight);
    }
  }, []);

  const handleLoad2 = useCallback((event: {nativeEvent: VideoPlayerLoadEvent}) => {
    const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
    setDuration2Ms(durationMs);
    if (videoWidth > 0 && videoHeight > 0) {
      setAspectRatio2(videoWidth / videoHeight);
    }
  }, []);

  const handleProgress1 = useCallback((_event: {nativeEvent: VideoPlayerProgressEvent}) => {
    // Could update a shared playback time indicator if needed
  }, []);

  const togglePlayback = useCallback(() => {
    setPaused((prev) => !prev);
    setSeekMs1(undefined);
    setSeekMs2(undefined);
  }, []);

  const handleRepPress = useCallback((repIndex: number) => {
    if (!result1) {
      return;
    }
    // Seek each player to its own rep's start position — videos may have different
    // pacing or trimming, so using a single timestamp would land video B at the
    // wrong moment.
    const positions = computeRepSeekPositions(result1, result2, repIndex);
    if (!positions) {
      return;
    }
    setSeekMs1(positions.seekMs1);
    setSeekMs2(positions.seekMs2);
    setCurrentRepIndex(repIndex);
    setPaused(false);
  }, [result1, result2]);

  const cycleSpeed = useCallback(() => {
    setPlaybackSpeed((prev) => {
      if (prev >= 1.0) {
        return 0.5;
      }
      if (prev >= 0.5) {
        return 0.25;
      }
      return 1.0;
    });
  }, []);

  const repResults1 = result1 ? (analysis1?.setResult?.repResults ?? result1.repSegments.map((seg, i) => {
    const phaseTimes = computeRepPhaseTimesMs(result1.barPathSeries, seg.startMs, seg.turnaroundMs, seg.endMs, result1.analysisMeta);
    return {
      repIndex: i,
      startMs: seg.startMs,
      turnaroundMs: seg.turnaroundMs,
      endMs: seg.endMs,
      totalTimeMs: seg.endMs - seg.startMs,
      eccentricTimeMs: phaseTimes.eccentricTimeMs,
      concentricTimeMs: phaseTimes.concentricTimeMs,
      vAvg: 0,
      vPeak: 0,
    };
  })) : [];

  const repResults2 = result2 ? (analysis2?.setResult?.repResults ?? result2.repSegments.map((seg, i) => {
    const phaseTimes = computeRepPhaseTimesMs(result2.barPathSeries, seg.startMs, seg.turnaroundMs, seg.endMs, result2.analysisMeta);
    return {
      repIndex: i,
      startMs: seg.startMs,
      turnaroundMs: seg.turnaroundMs,
      endMs: seg.endMs,
      totalTimeMs: seg.endMs - seg.startMs,
      eccentricTimeMs: phaseTimes.eccentricTimeMs,
      concentricTimeMs: phaseTimes.concentricTimeMs,
      vAvg: 0,
      vPeak: 0,
    };
  })) : [];

  if (!analysis1 || !analysis2) {
    return (
      <View style={[styles.centered, themedStyles.background]}>
        <Text>One or both analyses not found.</Text>
      </View>
    );
  }

  const hasVideos = !!(analysis1.localVideoPath && analysis2.localVideoPath);
  const hasResults = !!(result1 && result2);

  return (
    <ScrollView
      style={[styles.container, themedStyles.background]}
      contentInsetAdjustmentBehavior="automatic"
      testID="video-analysis-compare-screen"
    >
      {/* Analysis info cards */}
      <View style={styles.twoColumnRow}>
        <Card style={[styles.halfCard]}>
          <Card.Title
            title={`Analysis A #${analysis1.id}`}
            titleStyle={themedStyles.labelA}
            subtitle={new Date(analysis1.createdAt).toLocaleString()}
          />
          <Card.Content>
            <Text style={styles.statusText}>Status: {analysis1.status}</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.halfCard]}>
          <Card.Title
            title={`Analysis B #${analysis2.id}`}
            titleStyle={themedStyles.labelB}
            subtitle={new Date(analysis2.createdAt).toLocaleString()}
          />
          <Card.Content>
            <Text style={styles.statusText}>Status: {analysis2.status}</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Video sync section */}
      {hasVideos && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Synchronized Playback" />
            <Card.Content>
              <View style={styles.twoColumnRow}>
                <View style={[styles.videoWrapper, {aspectRatio: aspectRatio1}, themedStyles.videoContainerA]}>
                  <VideoAnalysisPlayerView
                    source={analysis1.localVideoPath!}
                    paused={paused}
                    seekPositionMs={seekMs1}
                    playbackSpeed={playbackSpeed}
                    barPathSeries={result1?.barPathSeries}
                    repSegments={result1?.repSegments}
                    currentRepIndex={currentRepIndex}
                    primaryColor={primaryColor1}
                    pathColor={pathColor}
                    trackingFrameWidthPx={result1?.analysisMeta.trackingFrameWidthPx}
                    trackingFrameHeightPx={result1?.analysisMeta.trackingFrameHeightPx}
                    onLoad={handleLoad1}
                    onProgress={handleProgress1}
                    style={styles.video}
                  />
                </View>
                <View style={[styles.videoWrapper, {aspectRatio: aspectRatio2}, themedStyles.videoContainerB]}>
                  <VideoAnalysisPlayerView
                    source={analysis2.localVideoPath!}
                    paused={paused}
                    seekPositionMs={seekMs2}
                    playbackSpeed={playbackSpeed}
                    barPathSeries={result2?.barPathSeries}
                    repSegments={result2?.repSegments}
                    currentRepIndex={currentRepIndex}
                    primaryColor={primaryColor2}
                    pathColor={pathColor}
                    trackingFrameWidthPx={result2?.analysisMeta.trackingFrameWidthPx}
                    trackingFrameHeightPx={result2?.analysisMeta.trackingFrameHeightPx}
                    onLoad={handleLoad2}
                    style={styles.video}
                  />
                </View>
              </View>
              <View style={[styles.videoControls, themedStyles.controlsBackground]}>
                <IconButton
                  testID="compare-play-pause-button"
                  icon={paused ? 'play' : 'pause'}
                  onPress={togglePlayback}
                  size={28}
                />
                <Button
                  testID="compare-speed-button"
                  mode="outlined"
                  compact
                  onPress={cycleSpeed}
                  style={styles.speedButton}
                >
                  {`${playbackSpeed}×`}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </>
      )}

      {/* Velocity overlay chart */}
      {hasResults && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.card}>
            <Card.Title title="Velocity Overlay" />
            <Card.Content>
              <VelocityCompareChart
                barPathSeries1={result1!.barPathSeries}
                barPathSeries2={result2!.barPathSeries}
                height={220}
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
                trackingFrameWidth1={result1!.analysisMeta.trackingFrameWidthPx}
                trackingFrameHeight1={result1!.analysisMeta.trackingFrameHeightPx}
                trackingFrameWidth2={result2!.analysisMeta.trackingFrameWidthPx}
                trackingFrameHeight2={result2!.analysisMeta.trackingFrameHeightPx}
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
            <Card.Title title="Rep Comparison" />
            <Card.Content>
              <CompareRepSummary
                repResults1={repResults1}
                repResults2={repResults2}
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
  halfCard: {
    flex: 1,
    margin: 4,
  },
  divider: {
    marginHorizontal: 10,
    marginVertical: 4,
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginHorizontal: 6,
    marginTop: 10,
  },
  videoWrapper: {
    flex: 1,
    margin: 4,
    borderWidth: 2,
    borderRadius: 6,
    overflow: 'hidden',
    minHeight: 120,
  },
  video: {
    flex: 1,
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 8,
    padding: 4,
  },
  speedButton: {
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
  },
});

export default VideoAnalysisCompareTab;
