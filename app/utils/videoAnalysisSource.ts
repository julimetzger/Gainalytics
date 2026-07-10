import {VideoAnalysis} from '../models/entities/VideoAnalysis';

/**
 * Prefix the native player uses to signal that a video source cannot be opened,
 * as opposed to a decoder/playback failure.
 */
export const SOURCE_UNAVAILABLE_PREFIX = 'SOURCE_UNAVAILABLE::';

export const isSourceUnavailableError = (message?: string) => {
  return !!message && message.startsWith(SOURCE_UNAVAILABLE_PREFIX);
};

/**
 * A video is "secured" once it has been copied into app-private storage. That happens
 * for analyses imported before the gallery-backed import landed, and for analyses the
 * user explicitly pulled in via the full-import button.
 */
export const isVideoSecuredInApp = (analysis?: Pick<VideoAnalysis, 'localVideoPath'>) => {
  return !!analysis?.localVideoPath;
};

/**
 * The URI to hand to the player / analyzer.
 *
 * An app-private copy always wins: it is guaranteed to exist and needs no URI grant.
 * Otherwise we read the gallery URI directly, which is the default since GH-321.
 */
export const resolveVideoPlaybackUri = (
  analysis?: Pick<VideoAnalysis, 'localVideoPath' | 'sourceUri'>,
): string | undefined => {
  // An empty string is not a playable source — normalise it away so callers can
  // simply check for undefined.
  return analysis?.localVideoPath || analysis?.sourceUri || undefined;
};

/** Gallery URIs are the only ones we hold a persistable grant for. */
export const holdsGalleryUriPermission = (analysis?: Pick<VideoAnalysis, 'sourceUri'>) => {
  return !!analysis?.sourceUri && analysis.sourceUri.startsWith('content://');
};

/**
 * GH-321: the persistable gallery grant is held per content:// URI for the whole app, not
 * per analysis. When the user imports the same gallery clip twice, both analyses share one
 * grant. Deleting one of them must therefore only give the grant back once *no other*
 * analysis still relies on the same source video — otherwise the surviving analysis would
 * lose playback and full-import even though it was never deleted.
 *
 * Returns true when the grant must be kept because another analysis still uses `sourceUri`.
 */
export const isGalleryUriStillInUse = (
  sourceUri: string | undefined,
  analyses: ReadonlyArray<Pick<VideoAnalysis, 'id' | 'sourceUri'>>,
  excludeAnalysisId?: number,
): boolean => {
  if (!sourceUri || !sourceUri.startsWith('content://')) {
    return false;
  }
  return analyses.some(
    (analysis) => analysis.id !== excludeAnalysisId && analysis.sourceUri === sourceUri,
  );
};
