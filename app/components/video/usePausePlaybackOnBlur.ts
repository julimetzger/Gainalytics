import {useEffect, useRef} from 'react';
import {useIsFocused} from '@react-navigation/native';

/**
 * GH-695: pauses a running video playback as soon as its screen loses focus —
 * switching to another bottom tab, or pushing another screen on top. The
 * screens stay mounted in the navigator, so without this the native player
 * kept playing (with sound) in the background. Playback is not resumed on
 * refocus: the user continues with the play button where they left off.
 */
export const usePausePlaybackOnBlur = (playing: boolean, pause: () => void) => {
  const isFocused = useIsFocused();
  const pauseRef = useRef(pause);
  pauseRef.current = pause;

  useEffect(() => {
    if (!isFocused && playing) {
      pauseRef.current();
    }
  }, [isFocused, playing]);
};
