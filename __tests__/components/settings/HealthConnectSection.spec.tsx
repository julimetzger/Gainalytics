import React from 'react';
import {Linking, NativeModules, Platform} from 'react-native';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {applyMiddleware, legacy_createStore as createStore} from 'redux';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {createHealthConnectMiddleware} from '../../../app/redux/HealthConnect/healthConnectMiddleware';
import {HealthConnectState} from '../../../app/redux/HealthConnect/healthConnectReducer';
import {HC_PERMISSION, HEALTH_CONNECT_PLAY_STORE_URL} from '../../../app/utils/healthConnect/healthConnectNative';
import HealthConnectSection from '../../../app/components/settings/HealthConnectSection';

// jest.setup.js stubs react-redux; this spec needs the real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));
const {Provider} = jest.requireActual('react-redux');

const fakeModule = (sdkStatus: string, granted: string[], providedBySystem = false) => ({
  getSdkStatus: jest.fn(async () => sdkStatus),
  isProvidedBySystem: jest.fn(async () => providedBySystem),
  getGrantedPermissions: jest.fn(async () => granted),
  requestPermissions: jest.fn(async () => granted),
  isHistoryReadAvailable: jest.fn(async () => true),
  readWeights: jest.fn(async () => []),
  openManagePermissions: jest.fn(async () => true),
  openHealthConnect: jest.fn(async () => true),
});

const renderSection = (module: ReturnType<typeof fakeModule>, healthConnect: Partial<HealthConnectState> = {}) => {
  NativeModules.HealthConnect = module;
  const initial: GlobalState = rootReducer(undefined, {type: '@@INIT'});
  const store = createStore(
    rootReducer,
    {...initial, healthConnect: {writeEnabled: false, everConnected: false, written: {}, ...healthConnect}},
    applyMiddleware(createHealthConnectMiddleware()),
  );
  const view = render(
    <Provider store={store}>
      <PaperProvider>
        <HealthConnectSection />
      </PaperProvider>
    </Provider>,
  );
  return {store, ...view};
};

describe('GH-528 HealthConnectSection', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    // The jest preset renders as iOS, where Health Connect does not exist.
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = originalOS;
  });
  afterEach(() => {
    delete NativeModules.HealthConnect;
  });

  it('shows "not installed" with a Play Store link on Android 13 and lower', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const {findByText, getByTestId, queryByTestId} = renderSection(fakeModule('UNAVAILABLE', [], false));

    expect(await findByText('Not installed')).toBeTruthy();
    expect(queryByTestId('health-connect-connect')).toBeNull();
    fireEvent.press(getByTestId('health-connect-play-store'));
    expect(openURL).toHaveBeenCalledWith(HEALTH_CONNECT_PLAY_STORE_URL);
  });

  it('offers to connect when available and requests exactly the feature permissions', async () => {
    const module = fakeModule('AVAILABLE', []);
    const {findByText, getByTestId} = renderSection(module);

    expect(await findByText('Available · not connected')).toBeTruthy();
    await act(async () => fireEvent.press(getByTestId('health-connect-connect')));
    expect(module.requestPermissions.mock.calls).toEqual([[[HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE, HC_PERMISSION.READ_WEIGHT]]]);
  });

  it('lists the granted permissions and enables the write switch only with write permission', async () => {
    const {findByText, getByTestId, store} = renderSection(fakeModule('AVAILABLE', [HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE, HC_PERMISSION.READ_WEIGHT]));

    expect(await findByText('Connected')).toBeTruthy();
    expect(getByTestId('health-connect-permissions')).toHaveTextContent('Allowed: Read trainings, Write trainings, Read body weight');
    fireEvent(getByTestId('health-connect-write-switch'), 'valueChange', true);
    expect(store.getState().healthConnect?.writeEnabled).toBe(true);
  });

  it('shows revoked permissions after an earlier connection and keeps the switch off', async () => {
    const {findByText, getByTestId} = renderSection(fakeModule('AVAILABLE', []), {everConnected: true});

    expect(await findByText('Permissions revoked')).toBeTruthy();
    expect(getByTestId('health-connect-connect')).toHaveTextContent('Connect again');
    await waitFor(() => expect(getByTestId('health-connect-write-switch').props.accessibilityState).toEqual(expect.objectContaining({disabled: true})));
  });

  it('renders nothing where Health Connect does not exist (iOS)', async () => {
    const {store, queryByTestId, findByText} = renderSection(fakeModule('AVAILABLE', []));
    expect(await findByText('Available · not connected')).toBeTruthy();
    delete NativeModules.HealthConnect;
    await act(async () => store.dispatch({type: 'HEALTH_CONNECT_REFRESH', force: true}));

    await waitFor(() => expect(store.getState().healthConnect?.status).toEqual({sdkStatus: 'NOT_SUPPORTED'}));
    expect(queryByTestId('settings-section-health-connect')).toBeNull();
  });
});
