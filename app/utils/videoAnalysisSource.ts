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
