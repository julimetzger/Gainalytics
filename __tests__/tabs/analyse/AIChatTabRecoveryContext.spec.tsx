/**
 * GH-619 — sleep and steps from Health Connect as recovery context, driven through the real
 * screen with a real store, the real Health Connect middleware and a fake native module.
 *
 * The context preview renders the very strings the system prompt is built from, so the tests
 * compare the preview with the prompt that actually reaches sendChatMessage.
 */

import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppState} from 'react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {Provider as ReduxProvider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {createHealthConnectMiddleware} from '../../../app/redux/HealthConnect/healthConnectMiddleware';
import {HEALTH_CONNECT_ACTIONS, HealthConnectState} from '../../../app/redux/HealthConnect/healthConnectReducer';
import {HC_PERMISSION, HealthConnectDailySteps, HealthConnectSleepSession} from '../../../app/utils/healthConnect/healthConnectNative';
import {getYYYYMMDDFormat} from '../../../app/utils/DateHelper';

jest.mock('react-redux', () => jest.requireActual('react-redux'));

const mockSendChatMessage = jest.fn();
jest.mock('../../../app/utils/ai/sendChatMessage', () => ({
  sendChatMessage: (...args: any[]) => mockSendChatMessage(...args),
}));

jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    hasAnthropicApiKey: () => true,
    getAnthropicApiKey: () => 'test-key',
  },
  subscribeToApiKeyChanges: () => () => {},
}));

jest.mock('@react-navigation/elements', () => ({useHeaderHeight: () => 0}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn(), setOptions: jest.fn()})}));

jest.mock('react-native-markdown-display', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: ({children}: any) => <Text>{children}</Text>};
});

jest.mock('../../../app/redux/AIChat/use/useArchiveActiveChat', () => ({
  useArchiveActiveChat: () => async () => {},
}));

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const {Text} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');
  return {__esModule: true, default: () => <Text testID="date-range-picker-stub">range picker</Text>, Range: actual.Range};
});

import AIChatTab from '../../../app/tabs/Analyse/AIChatTab';

const DAY_MS = 24 * 60 * 60 * 1000;
// Inside the screen's default 28-day window, relative to today so the test does not age out.
const today = new Date();
const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
const SLEEP: HealthConnectSleepSession[] = [{startMs: twoDaysAgo.getTime() + 23 * 60 * 60 * 1000, endMs: yesterday.getTime() + 5 * 60 * 60 * 1000, stages: []}];
const STEPS: HealthConnectDailySteps[] = [{date: getYYYYMMDDFormat(twoDaysAgo), steps: 20113}];
const EXPECTED_JSON = `[\n{"date":"${getYYYYMMDDFormat(twoDaysAgo)}","steps":20113},\n{"date":"${getYYYYMMDDFormat(yesterday)}","sleep_h":6}\n]`;

const fakeModule = (granted: string[]) => ({
  getSdkStatus: jest.fn(async () => 'AVAILABLE' as const),
  isProvidedBySystem: jest.fn(async () => true),
  getGrantedPermissions: jest.fn(async () => granted),
  requestPermissions: jest.fn(async () => granted),
  isHistoryReadAvailable: jest.fn(async () => true),
  readWeights: jest.fn(async () => []),
  readSleepSessions: jest.fn(async () => SLEEP),
  readDailySteps: jest.fn(async () => STEPS),
  writeStrengthSession: jest.fn(async () => []),
  deleteStrengthSession: jest.fn(async () => true),
  openHealthConnect: jest.fn(async () => true),
  openManagePermissions: jest.fn(async () => true),
});

function renderTab(healthConnect: HealthConnectState | undefined, module: ReturnType<typeof fakeModule> | undefined) {
  const initial: GlobalState = rootReducer(undefined, {type: '@@INIT'});
  const store = configureStore({
    reducer: rootReducer as any,
    preloadedState: {...initial, settings: {...initial.settings, aiChatPrompt: 'You are a powerlifting coach.'}, healthConnect} as any,
    middleware: getDefault =>
      getDefault({serializableCheck: false, immutableCheck: false}).concat(
        createHealthConnectMiddleware({getModule: () => module, notify: jest.fn(), now: () => Date.now()}),
      ),
  });
  render(
    <ReduxProvider store={store}>
      <PaperProvider>
        <AIChatTab />
      </PaperProvider>
    </ReduxProvider>,
  );
  return store;
}

const connectedWith = (granted: string[]): HealthConnectState => ({
  writeEnabled: false,
  everConnected: true,
  written: {},
  status: {sdkStatus: 'AVAILABLE', providedBySystem: true, granted, historyReadAvailable: true},
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
  });
};

const previewSections = () => {
  fireEvent.press(screen.getByTestId('chat-context-inspect'));
  const keys = ['selected', 'planned', 'recovery', 'finished'].filter(key => screen.queryByTestId(`chat-context-preview-${key}`));
  const texts = keys.map(key => `${screen.getByTestId(`chat-context-preview-title-${key}`).props.children}:\n\n${screen.getByTestId(`chat-context-preview-${key}`).props.children}`);
  fireEvent.press(screen.getByTestId('chat-context-preview-close'));
  return {keys, texts};
};

const sendAndCapturePrompt = async () => {
  mockSendChatMessage.mockResolvedValueOnce({ok: true, text: 'ok', hadContext: true, truncated: false});
  fireEvent.changeText(screen.getByTestId('chat-input'), 'Why was my squat weak?');
  await act(async () => {
    fireEvent.press(screen.getByTestId('chat-send-button'));
  });
  return mockSendChatMessage.mock.calls[mockSendChatMessage.mock.calls.length - 1][2] as string;
};

describe('GH-619 recovery context in the AI chat', () => {
  beforeEach(() => mockSendChatMessage.mockReset());

  it('without Health Connect: no switch, a hint, nothing read and the prompt unchanged', async () => {
    const module = fakeModule([]);
    renderTab(undefined, module);
    fireEvent.press(screen.getByTestId('chat-context-badge'));
    await flush();

    expect(screen.queryByTestId('chat-recovery-switch')).toBeNull();
    expect(screen.getByTestId('chat-recovery-hint').props.children).toBe('Sleep and steps: connect Health Connect in Settings to include them.');
    expect(previewSections().keys).toEqual([]);
    expect(await sendAndCapturePrompt()).toBe('You are a powerlifting coach.');
    expect([module.readSleepSessions.mock.calls, module.readDailySteps.mock.calls]).toEqual([[], []]);
  });

  it('with permissions the switch is offered but off by default: nothing is read or sent', async () => {
    const module = fakeModule([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]);
    renderTab(connectedWith([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]), module);
    fireEvent.press(screen.getByTestId('chat-context-badge'));
    await flush();

    expect(screen.getByTestId('chat-recovery-switch').props.value).toBe(false);
    expect(screen.getByTestId('chat-recovery-info').props.children).toBe('Sleep and steps from Health Connect are not sent.');
    expect(previewSections().keys).toEqual([]);
    expect(module.readSleepSessions).not.toHaveBeenCalled();
  });

  it('switched on: the preview shows one line per day and the prompt carries exactly that section', async () => {
    const module = fakeModule([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]);
    const store = renderTab(connectedWith([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]), module);
    fireEvent.press(screen.getByTestId('chat-context-badge'));
    fireEvent(screen.getByTestId('chat-recovery-switch'), 'valueChange', true);
    await flush();

    expect(store.getState().aiChat.includeRecoveryContext).toBe(true);
    expect(screen.getByTestId('chat-recovery-info').props.children).toBe('Sleep and steps attached: 2 days');
    const {keys, texts} = previewSections();
    expect(keys).toEqual(['recovery']);
    expect(screen.getByTestId('chat-context-preview-recovery').props.children).toBe(EXPECTED_JSON);
    expect(await sendAndCapturePrompt()).toBe(`You are a powerlifting coach.\n\nAnalysis context:\n\n${texts.join('\n\n')}`);
    // The 28-day window, sleep from one day earlier and through the end of the last day.
    const [[sleepStart, sleepEnd]] = module.readSleepSessions.mock.calls as unknown as number[][];
    const [[stepsStart]] = module.readDailySteps.mock.calls as unknown as number[][];
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    expect([stepsStart - sleepStart, sleepEnd]).toEqual([DAY_MS, tomorrow]);
  });

  it('switched on: reads sleep and steps again when the app returns to the foreground', async () => {
    const addListener = AppState.addEventListener as jest.Mock;
    addListener.mockClear();
    const module = fakeModule([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]);
    renderTab(connectedWith([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]), module);
    fireEvent.press(screen.getByTestId('chat-context-badge'));
    fireEvent(screen.getByTestId('chat-recovery-switch'), 'valueChange', true);
    await flush();
    expect(module.readDailySteps).toHaveBeenCalledTimes(1);

    // Synced while the app was in the background.
    module.readDailySteps.mockResolvedValue([{date: getYYYYMMDDFormat(twoDaysAgo), steps: 25000}]);
    // The newest subscription is the recovery hook's (the mock never unsubscribes older ones).
    const [event, onChange] = addListener.mock.calls[addListener.mock.calls.length - 1];
    expect(event).toBe('change');
    await act(async () => {
      onChange('active');
    });
    await flush();

    expect(module.readDailySteps).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId('chat-context-inspect'));
    expect(screen.getByTestId('chat-context-preview-recovery').props.children).toContain('"steps":25000');
  });

  it('revoking READ_SLEEP removes only the sleep values; revoking both hides the switch and the section', async () => {
    const module = fakeModule([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]);
    const store = renderTab(connectedWith([HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]), module);
    fireEvent.press(screen.getByTestId('chat-context-badge'));
    fireEvent(screen.getByTestId('chat-recovery-switch'), 'valueChange', true);
    await flush();

    const status = (granted: string[]) => ({type: HEALTH_CONNECT_ACTIONS.STATUS, status: {sdkStatus: 'AVAILABLE', providedBySystem: true, granted, historyReadAvailable: true}});
    module.getGrantedPermissions.mockResolvedValue([HC_PERMISSION.READ_STEPS]);
    await act(async () => {
      store.dispatch(status([HC_PERMISSION.READ_STEPS]));
    });
    await flush();

    fireEvent.press(screen.getByTestId('chat-context-inspect'));
    expect(screen.getByTestId('chat-context-preview-recovery').props.children).toBe(`[\n{"date":"${getYYYYMMDDFormat(twoDaysAgo)}","steps":20113}\n]`);
    fireEvent.press(screen.getByTestId('chat-context-preview-close'));

    await act(async () => {
      store.dispatch(status([HC_PERMISSION.READ_WEIGHT]));
    });
    await flush();

    expect(screen.queryByTestId('chat-recovery-switch')).toBeNull();
    expect(screen.getByTestId('chat-recovery-hint').props.children).toBe('Sleep and steps: allow "Read sleep" or "Read steps" in Settings → Health Connect.');
    expect(previewSections().keys).toEqual([]);
    expect(await sendAndCapturePrompt()).toBe('You are a powerlifting coach.');
  });
});
