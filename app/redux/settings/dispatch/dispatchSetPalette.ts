import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export type PaletteName = 'blue' | 'green' | 'purple';

export const dispatchSetPalette = () => {
  const dispatch = useDispatch();

  return (palette: PaletteName) =>
    dispatch({
      type: 'SET_PALETTE',
      palette,
    } as Action & {palette: PaletteName});
};
