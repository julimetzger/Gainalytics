import React from 'react';
import {NativeSyntheticEvent, requireNativeComponent, ViewProps} from 'react-native';

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

interface VideoAnalysisPlayerViewProps extends ViewProps {
  source: string;
  paused: boolean;
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
