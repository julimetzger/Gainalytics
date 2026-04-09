export enum VideoAnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  AWAITING_SEED_SELECTION = 'awaiting_seed_selection',
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
  setIndex?: number;
  sourceUri: string;
  localVideoPath?: string;
  createdAt: Date;
  status: VideoAnalysisStatus;
  videoMeta: VideoMeta;
  resultPath?: string;
  manualSeedFramePath?: string;
  seedCandidates?: SeedCandidate[];
  seedFrameWidthPx?: number;
  seedFrameHeightPx?: number;
  analysisMeta?: AnalysisMeta;
  setResult?: VideoAnalysisSetResult;
  error?: string;
}

export interface SeedCandidate {
  id: string;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  score: number;
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
  turnaroundMs: number;
  endMs: number;
}

export interface RepMetric {
  repIndex: number;
  repTimeMs: number;
  concentricTimeMs: number;
  averageConcentricSpeedPxPerS: number;
  lowestConcentricSpeedPxPerS: number;
}

export interface VideoAnalysisRepResult {
  repIndex: number;
  startMs: number;
  turnaroundMs: number;
  endMs: number;
  totalTimeMs: number;
  eccentricTimeMs: number;
  concentricTimeMs: number;
  vAvg: number;
  vPeak: number;
  /** X-deviation per resampled Y-point: concentric_x − eccentric_x (in px) */
  delta_x?: number[];
  /** Mean |delta_x| normalised to tracking frame width (0.0–1.0+) */
  path_deviation?: number;
}

export interface VideoAnalysisSetResult {
  repResults: VideoAnalysisRepResult[];
  velocityLossPercent: number | null;
  rirEstimate: string | null;
  calibratedAt?: string;
  /** Mean path_deviation across all reps (normalised, 0–1+) */
  mean_path_deviation?: number | null;
  /** Linear slope of path_deviation over reps (positive = increasing drift) */
  path_deviation_slope?: number | null;
}

export interface DetectedBox {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export interface AnalysisMeta {
  sourceFps: number;
  analyzedFps: number;
  frameCount: number;
  averageConfidence: number;
  trackerVersion?: string;
  repDetectionVersion?: string;
  trackingFrameWidthPx?: number;
  trackingFrameHeightPx?: number;
  manualSeedUsed?: boolean;
  detectedBoxesAtStart?: DetectedBox[];
  initialSeedBox?: DetectedBox;
  plausibilityRejections?: PlausibilityRejection[];
  performanceMetrics?: AnalysisPerformanceMetrics;
}

export interface PlausibilityRejection {
  sampleIndex: number;
  tMs: number;
  previousX: number;
  previousY: number;
  candidateX: number;
  candidateY: number;
  deltaX: number;
  deltaY: number;
  axisJumpX?: number;
  axisJumpY?: number;
  jumpDistance: number;
  threshold: number;
  reason?: string;
  score: number;
}

export interface AnalysisPerformanceMetrics {
  previewFrameWriteMs: number;
  initialFrameReadMs: number;
  initialDetectionMs: number;
  durationMetadataMs: number;
  sourceFpsMetadataMs: number;
  totalPreflightMs?: number;
  trackingMs: number;
  totalAnalysisMs: number;
  analyzedFps: number;
  plannedSampleCount: number;
  sampleAttemptCount: number;
  decodedFrameCount: number;
  nullFrameCount: number;
  noCandidateFrameCount: number;
  implausibleFrameCount: number;
  acceptedFrameCount: number;
  detectionCallCount: number;
  queuedInputSampleCount: number;
  dequeuedOutputFrameCount: number;
  processedOutputFrameCount: number;
  skippedDecodedFrameCount: number;
  decoderSetupMs: number;
  frameExtractionMs: number;
  decoderQueueInputMs: number;
  decoderDequeueOutputMs: number;
  frameConversionMs: number;
  letterboxMs: number;
  inputTensorMs: number;
  inferenceMs: number;
  candidateDecodeMs: number;
  totalDetectionMs: number;
  avgFrameExtractionMs: number;
  avgDetectionMs: number;
  avgInferenceMs: number;
  avgFrameConversionMs: number;
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
