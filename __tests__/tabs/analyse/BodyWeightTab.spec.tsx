/// <reference types="@testing-library/jest-native" />
// The CI typecheck uses the root tsconfig, which does not load the jest-native matcher types.
import React from 'react';
import {NativeModules, Platform} from 'react-native';
import {render, waitFor} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {applyMiddleware, legacy_createStore as createStore} from 'redux';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {createHealthConnectMiddleware} from '../../../app/redux/HealthConnect/healthConnectMiddleware';
import {HC_PERMISSION} from '../../../app/utils/healthConnect/healthConnectNative';
import BodyWeightTab from '../../../app/tabs/Analyse/BodyWeightTab';

// jest.setup.js stubs react-redux; this spec needs the real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));
const {Provider} = jest.requireActual('react-redux');

jest.mock('react-native-charts-wrapper', () => {
  const {View} = require('react-native');
  return {LineChart: (props: {testID?: string}) => <View testID={props.testID ?? 'line-chart'} />};
});

// FlashList renders no rows without a layout pass; a FlatList renders them in the test renderer.
jest.mock('@shopify/flash-list', () => {
  const {FlatList} = require('react-native');
  return {FlashList: FlatList};
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const {Text} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');
  return {__esModule: true, default: () => <Text testID="mock-range-picker">range</Text>, Range: actual.Range};
});

// The default range ends this week, so the manual entry must be recent.
const NOW = Date.now();

const fakeModule = (granted: string[]) => ({
  getSdkStatus: jest.fn(async () => 'AVAILABLE'),
  isProvidedBySystem: jest.fn(async () => true),
  getGrantedPermissions: jest.fn(async () => granted),
  isHistoryReadAvailable: jest.fn(async () => true),
  readWeights: jest.fn(async (_startMs: number, _endMs: number) => [
    {kg: 83.4, time: NOW - 20 * 86400000, origin: 'com.withings.wiscale2', originLabel: 'Withings'},
    {kg: 82.5, time: NOW - 86400000, origin: 'com.withings.wiscale2', originLabel: 'Withings'},
  ]),
});

const renderTab = (module: ReturnType<typeof fakeModule>) => {
  NativeModules.HealthConnect = module;
  const initial: GlobalState = rootReducer(undefined, {type: '@@INIT'});
  const store = createStore(
    rootReducer,
    {
      ...initial,
      bodyWeight: {byId: {1: {id: 1, date: NOW - 2 * 86400000, weightKg: 81}}, allIds: [1]},
      healthConnect: {writeEnabled: false, everConnected: true, written: {}},
    },
    applyMiddleware(createHealthConnectMiddleware()),
  );
  store.dispatch({type: 'HEALTH_CONNECT_REFRESH'});
  return render(
    <Provider store={store}>
      <PaperProvider>
        <BodyWeightTab />
      </PaperProvider>
    </Provider>,
  );
};

describe('BodyWeightTab: manual entries (GH-546) and Health Connect (GH-528)', () => {
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

  it('shows the Health Connect values below the manual entries when body weight may be read', async () => {
    const module = fakeModule([HC_PERMISSION.READ_WEIGHT]);
    const {findByTestId, getByTestId, getByText, queryByTestId} = renderTab(module);

    expect(await findByTestId('body-weight-hc-current')).toHaveTextContent('82.5 kg');
    expect(getByTestId('body-weight-current-origin')).toHaveTextContent(/· from Withings$/);
    expect(getByText('History (2)')).toBeTruthy();
    expect(getByTestId('body-weight-row-0')).toHaveTextContent(/82\.5 kg/);
    expect(getByTestId('body-weight-current')).toHaveTextContent('81 kg');
    expect(queryByTestId('body-weight-not-connected')).toBeNull();
  });

  it('shows only the manual entries and never reads Health Connect without the weight permission', async () => {
    const module = fakeModule([HC_PERMISSION.WRITE_EXERCISE]);
    const {getByTestId, queryByTestId} = renderTab(module);

    await waitFor(() => expect(module.getGrantedPermissions).toHaveBeenCalled());
    expect(getByTestId('body-weight-not-connected')).toBeTruthy();
    expect(getByTestId('body-weight-current')).toHaveTextContent('81 kg');
    expect(queryByTestId('body-weight-hc-section')).toBeNull();
    expect(module.readWeights.mock.calls).toEqual([]);
  });
});
