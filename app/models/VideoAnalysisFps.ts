/**
 * GH-621: frames per second the bar-path analysis samples. Higher = finer bar path and
 * velocity, but a longer analysis. The native side caps the rate at the video's own FPS.
 * Keep in sync with SUPPORTED_ANALYZED_FPS in VideoAnalysisModule.java.
 */
export const VIDEO_ANALYSIS_FPS_OPTIONS = [15, 20, 30] as const;

export type VideoAnalysisFps = (typeof VIDEO_ANALYSIS_FPS_OPTIONS)[number];

export const DEFAULT_VIDEO_ANALYSIS_FPS: VideoAnalysisFps = 30;

/** Anything other than a supported choice — including no choice at all — is the default. */
export function resolveVideoAnalysisFps(stored: unknown): VideoAnalysisFps {
  return VIDEO_ANALYSIS_FPS_OPTIONS.find((fps) => fps === stored) ?? DEFAULT_VIDEO_ANALYSIS_FPS;
}
