import {
  holdsGalleryUriPermission,
  isGalleryUriStillInUse,
  isSourceUnavailableError,
  isVideoSecuredInApp,
  resolveVideoPlaybackUri,
  SOURCE_UNAVAILABLE_PREFIX,
} from '../videoAnalysisSource';

describe('resolveVideoPlaybackUri', () => {
  it('plays a pre-GH-321 analysis from its app-private copy', () => {
    // Backward compatibility: analyses imported before the change still carry a
    // localVideoPath and must keep playing from it.
    const legacy = {localVideoPath: '/data/app/video-analysis/videos/analysis-1.mp4', sourceUri: 'content://media/1'};
    expect(resolveVideoPlaybackUri(legacy)).toBe('/data/app/video-analysis/videos/analysis-1.mp4');
  });

  it('plays a gallery-backed analysis directly from the source URI', () => {
    expect(resolveVideoPlaybackUri({sourceUri: 'content://media/42'})).toBe('content://media/42');
  });

  it('prefers the secured copy once the video has been fully imported', () => {
    const secured = {localVideoPath: '/data/videos/analysis-42.mp4', sourceUri: 'content://media/42'};
    expect(resolveVideoPlaybackUri(secured)).toBe('/data/videos/analysis-42.mp4');
  });

  it('returns undefined when there is no analysis and no source', () => {
    expect(resolveVideoPlaybackUri(undefined)).toBeUndefined();
    expect(resolveVideoPlaybackUri({sourceUri: ''})).toBeUndefined();
  });
});

describe('isVideoSecuredInApp', () => {
  it('is false for a gallery-backed analysis', () => {
    expect(isVideoSecuredInApp({sourceUri: 'content://media/42'} as never)).toBe(false);
  });

  it('is true once a local copy exists', () => {
    expect(isVideoSecuredInApp({localVideoPath: '/data/videos/a.mp4'})).toBe(true);
  });
});

describe('holdsGalleryUriPermission', () => {
  it('is true only for content URIs', () => {
    expect(holdsGalleryUriPermission({sourceUri: 'content://media/42'})).toBe(true);
    expect(holdsGalleryUriPermission({sourceUri: '/data/videos/a.mp4'})).toBe(false);
    expect(holdsGalleryUriPermission(undefined)).toBe(false);
  });
});

describe('isGalleryUriStillInUse', () => {
  it('keeps the grant when another analysis reuses the same gallery clip', () => {
    // Finding 2: the same content:// clip was imported twice. Deleting analysis #1 must
    // not revoke the grant that analysis #2 still relies on for playback / full import.
    const analyses = [
      {id: 1, sourceUri: 'content://media/42'},
      {id: 2, sourceUri: 'content://media/42'},
    ];
    expect(isGalleryUriStillInUse('content://media/42', analyses, 1)).toBe(true);
  });

  it('releases the grant when the deleted analysis was the last user of that clip', () => {
    const analyses = [
      {id: 1, sourceUri: 'content://media/42'},
      {id: 2, sourceUri: 'content://media/99'},
    ];
    expect(isGalleryUriStillInUse('content://media/42', analyses, 1)).toBe(false);
  });

  it('never holds a grant for non-gallery (app-private) sources', () => {
    const analyses = [
      {id: 1, sourceUri: '/data/videos/a.mp4'},
      {id: 2, sourceUri: '/data/videos/a.mp4'},
    ];
    expect(isGalleryUriStillInUse('/data/videos/a.mp4', analyses, 1)).toBe(false);
    expect(isGalleryUriStillInUse(undefined, analyses, 1)).toBe(false);
  });
});

describe('isSourceUnavailableError', () => {
  it('recognises the native unavailable signal and ignores other player errors', () => {
    expect(isSourceUnavailableError(`${SOURCE_UNAVAILABLE_PREFIX}content://media/42`)).toBe(true);
    expect(isSourceUnavailableError('Decoder init failed')).toBe(false);
    expect(isSourceUnavailableError(undefined)).toBe(false);
  });
});
