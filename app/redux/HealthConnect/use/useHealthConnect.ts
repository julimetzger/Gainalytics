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
  const {status, everConnected} = useHealthConnectState();
  return useMemo(() => describeHealthConnectConnection({status, everConnected}), [status, everConnected]);
};

/** Body weights read from Health Connect, oldest first; empty without a connection. */
export const useBodyWeights = () => useSelector((state: GlobalState) => state.healthConnect?.bodyWeights?.weights ?? EMPTY_WEIGHTS);

/** GH-619: sleep and steps last read for the AI chat; undefined until read or after revoking. */
export const useRecoveryData = () => useSelector((state: GlobalState) => state.healthConnect?.recovery);

export const useHealthConnectActions = () => {
  const dispatch = useDispatch();
  return useMemo(
    () => ({
      refresh: (force: boolean = false) => dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH, force}),
      connect: () => dispatch({type: HEALTH_CONNECT_ACTIONS.CONNECT}),
      requestHistory: () => dispatch({type: HEALTH_CONNECT_ACTIONS.REQUEST_HISTORY}),
      loadWeights: () => dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS}),
      loadRecovery: (startMs: number, endMs: number) => dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_RECOVERY, startMs, endMs}),
      setWriteEnabled: (enabled: boolean) => dispatch({type: HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED, enabled}),
    }),
    [dispatch],
  );
};
