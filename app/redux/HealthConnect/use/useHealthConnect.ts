import {useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {HEALTH_CONNECT_ACTIONS, HealthConnectState, initialHealthConnectState} from '../healthConnectReducer';
import {HealthConnectWeight} from '../../../utils/healthConnect/healthConnectNative';
import {describeHealthConnectConnection} from '../../../utils/healthConnect/healthConnectStatus';

const EMPTY_WEIGHTS: HealthConnectWeight[] = [];

export const selectHealthConnect = (state: GlobalState): HealthConnectState => state.healthConnect ?? initialHealthConnectState;

export const useHealthConnectState = () => useSelector(selectHealthConnect);

export const useHealthConnectConnection = () => {
  const state = useHealthConnectState();
  return useMemo(() => describeHealthConnectConnection(state), [state.status, state.everConnected]);
};

/** Body weights read from Health Connect, oldest first; empty without a connection. */
export const useBodyWeights = () => useSelector((state: GlobalState) => state.healthConnect?.bodyWeights?.weights ?? EMPTY_WEIGHTS);

export const useHealthConnectActions = () => {
  const dispatch = useDispatch();
  return useMemo(
    () => ({
      refresh: (force: boolean = false) => dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH, force}),
      connect: () => dispatch({type: HEALTH_CONNECT_ACTIONS.CONNECT}),
      requestHistory: () => dispatch({type: HEALTH_CONNECT_ACTIONS.REQUEST_HISTORY}),
      loadWeights: () => dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS}),
      setWriteEnabled: (enabled: boolean) => dispatch({type: HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED, enabled}),
    }),
    [dispatch],
  );
};
