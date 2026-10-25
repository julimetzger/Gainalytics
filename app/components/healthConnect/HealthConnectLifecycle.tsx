import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useHealthConnectActions} from '../../redux/HealthConnect/use/useHealthConnect';

/**
 * GH-528: re-reads Health Connect status, permissions and body weights on app start and whenever
 * the app comes back to the foreground (permissions may have been revoked meanwhile). The
 * middleware skips this entirely until the user has connected once.
 */
const HealthConnectLifecycle = () => {
  const {refresh} = useHealthConnectActions();
  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (appState) => appState === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);
  return null;
};

export default HealthConnectLifecycle;
