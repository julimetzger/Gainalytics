import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {PaletteSelection} from '../../../theme/palette';

/**
 * Either one of the built-in palette names, or a `#RRGGBB` colour picked from
 * the colour wheel.
 */
export type PaletteName = PaletteSelection;

export const dispatchSetPalette = () => {
  const dispatch = useDispatch();

  return (palette: PaletteName) =>
    dispatch({
      type: 'SET_PALETTE',
      palette,
    } as Action & {palette: PaletteName});
};
