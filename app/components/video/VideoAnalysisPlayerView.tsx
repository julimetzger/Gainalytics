import React from 'react';
import {NativeSyntheticEvent, requireNativeComponent, ViewProps} from 'react-native';
import {PoseOverlayTrack} from '../../utils/videoAnalysisPose';

export interface VideoPlayerLoadEvent {
  durationMs: number;
  videoWidth: number;
  videoHeight: number;
}

export interface VideoPlayerProgressEvent {
  currentTimeMs: number;
  durationMs: number;
}

export interface VideoPlayerErrorEvent {
  message: string;
}

export interface VideoBarPathPoint {
  tMs: number;
  x: number;
  y: number;
}

export interface VideoRepSegment {
  repIndex: number;
  startMs: number;
  turnaroundMs: number;
  endMs: number;
}

interface VideoAnalysisPlayerViewProps extends ViewProps {
  source: string;
  paused: boolean;
  seekPositionMs?: number;
  playbackSpeed?: number;
  barPathSeries?: VideoBarPathPoint[];
  repSegments?: VideoRepSegment[];
  currentRepIndex?: number;
  primaryColor?: number;
  pathColor?: number;
  trackingFrameWidthPx?: number;
  trackingFrameHeightPx?: number;
  /** GH-75 hip/knee overlay: pre-filtered tracks; the view interpolates them at the player time. */
  poseTracks?: PoseOverlayTrack[];
  poseMaxGapMs?: number;
  showPose?: boolean;
  onLoad?: (event: NativeSyntheticEvent<VideoPlayerLoadEvent>) => void;
  onProgress?: (event: NativeSyntheticEvent<VideoPlayerProgressEvent>) => void;
  onEnd?: () => void;
  onError?: (event: NativeSyntheticEvent<VideoPlayerErrorEvent>) => void;
}

const NativeVideoAnalysisPlayerView = requireNativeComponent<VideoAnalysisPlayerViewProps>('VideoAnalysisPlayerView');

const VideoAnalysisPlayerView = (props: VideoAnalysisPlayerViewProps) => {
  return <NativeVideoAnalysisPlayerView {...props} />;
};

export default VideoAnalysisPlayerView;
