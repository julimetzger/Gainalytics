export enum VideoAnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  DONE = 'done',
  NEEDS_MANUAL_SEED = 'needs_manual_seed',
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
  setIndex?: number;
  sourceUri: string;
  localVideoPath?: string;
  createdAt: Date;
  status: VideoAnalysisStatus;
  videoMeta: VideoMeta;
  resultPath?: string;
  manualSeedFramePath?: string;
  analysisMeta?: AnalysisMeta;
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

export interface RepSegment {
  repIndex: number;
  startMs: number;
  bottomMs: number;
  endMs: number;
}

export interface RepMetric {
  repIndex: number;
  averageConcentricSpeedPxPerS: number;
  lowestConcentricSpeedPxPerS: number;
  repTimeMs: number;
}

export interface DetectedCircle {
  x: number;
  y: number;
  radius: number;
  score?: number;
}

export interface AnalysisMeta {
  sourceFps: number;
  analyzedFps: number;
  frameCount: number;
  averageConfidence: number;
  trackingFrameWidthPx?: number;
  trackingFrameHeightPx?: number;
  manualSeedUsed?: boolean;
  detectedCirclesAtStart?: DetectedCircle[];
}

export interface BarTrackingResult {
  analysisId: number;
  units: 'px/s';
  barPathSeries: BarPathPoint[];
  confidenceSeries: ConfidencePoint[];
  repSegments: RepSegment[];
  repMetrics: RepMetric[];
  analysisMeta: AnalysisMeta;
  qualityFlags: string[];
}
