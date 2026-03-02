export enum VideoAnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export interface VideoMeta {
  durationMs: number;
  fps: number;
  width: number;
  height: number;
}

export interface VideoAnalysis {
  id?: number;
  exerciseId?: number;
  workoutId?: number;
  sourceUri: string;
  localVideoPath?: string;
  createdAt: Date;
  status: VideoAnalysisStatus;
  videoMeta: VideoMeta;
  resultPath?: string;
  error?: string;
}

export interface BarPathPoint {
  tMs: number;
  x: number;
  y: number;
}

export interface ConfidencePoint {
  tMs: number;
  score: number;
}

export interface BarTrackingMetrics {
  horizontalDriftPx: number;
  pathEfficiency: number;
  maxAscentVelocity: number;
  stickingRegion: {
    startMs: number;
    endMs: number;
  };
}

export interface BarTrackingResult {
  schemaVersion: 1;
  analysisId: number;
  trackingConfig: {
    mode: 'manual-anchor';
    frameRate: number;
  };
  barPathSeries: BarPathPoint[];
  confidenceSeries: ConfidencePoint[];
  metrics: BarTrackingMetrics;
  qualityFlags: string[];
}
