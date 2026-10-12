import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {ParsedStrongFile, StrongImportOptions} from '../../utils/strongCsv/strongImport';

export const dispatchStrongImport = () => {
  const dispatch = useDispatch();

  return (parsed: ParsedStrongFile, options: StrongImportOptions) =>
    dispatch({
      type: 'STRONG_IMPORT',
      parsed,
      options,
    } as Action);
};
