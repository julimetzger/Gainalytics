/**
 * GH-504: the ChatGPT part of Settings → AI Coach.
 */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import ChatGptAccountSection from '../../../app/components/settings/ChatGptAccountSection';

const mockAccount = {
  session: null as null | {email?: string; planUsage: boolean},
  phase: 'idle',
  message: null as null | {type: 'info' | 'error'; text: string},
  models: null as string[] | null,
  modelsError: null as string | null,
  startSignIn: jest.fn(),
  cancelSignIn: jest.fn(),
  signOut: jest.fn(),
  reloadModels: jest.fn(),
};
jest.mock('../../../app/components/settings/useChatGptAccount', () => ({
  useChatGptAccount: () => mockAccount,
}));
const mockSetModel = jest.fn();
jest.mock('../../../app/redux/settings/dispatch/dispatchSetChatGptModel', () => ({
  dispatchSetChatGptModel: () => mockSetModel,
}));
let mockChosenModel: string | undefined;
jest.mock('../../../app/redux/settings/use/useChatGptModel', () => ({
  useChatGptModel: () => mockChosenModel,
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccount, {session: null, phase: 'idle', message: null, models: null, modelsError: null});
  mockChosenModel = undefined;
});

describe('ChatGptAccountSection', () => {
  it('offers "Continue with ChatGPT" when not signed in', () => {
    const {getByTestId, queryByTestId} = render(<ChatGptAccountSection />);

    expect(getByTestId('settings-chatgpt-status')).toHaveTextContent('Not signed in');
    fireEvent.press(getByTestId('settings-chatgpt-signin-button'));
    expect(mockAccount.startSignIn).toHaveBeenCalledTimes(1);
    expect(queryByTestId('settings-chatgpt-signout-button')).toBeNull();
  });

  it('shows the running sign-in and lets the user cancel it', () => {
    mockAccount.phase = 'waiting';
    const {getByTestId} = render(<ChatGptAccountSection />);

    expect(getByTestId('settings-chatgpt-status')).toHaveTextContent('Waiting for sign-in in the browser…');
    fireEvent.press(getByTestId('settings-chatgpt-cancel-button'));
    expect(mockAccount.cancelSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows the account, the plan models with the first one as default, and signs out', () => {
    mockAccount.session = {email: 'a@b.c', planUsage: true};
    mockAccount.models = ['gpt-a', 'gpt-b'];
    const {getByTestId, queryByTestId} = render(<ChatGptAccountSection />);

    expect(getByTestId('settings-chatgpt-status')).toHaveTextContent('Connected as a@b.c');
    expect(getByTestId('settings-chatgpt-model-gpt-a')).toHaveProp('accessibilityState', expect.objectContaining({selected: true}));
    fireEvent.press(getByTestId('settings-chatgpt-model-gpt-b'));
    expect(mockSetModel).toHaveBeenCalledWith('gpt-b');
    fireEvent.press(getByTestId('settings-chatgpt-signout-button'));
    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(queryByTestId('settings-chatgpt-plan-usage-missing')).toBeNull();
  });

  it('explains a missing plan-usage grant and shows the error of a failed sign-in', () => {
    mockAccount.session = {email: 'a@b.c', planUsage: false};
    mockAccount.message = {type: 'error', text: 'Sign-in timed out.'};
    const {getByTestId} = render(<ChatGptAccountSection />);

    expect(getByTestId('settings-chatgpt-plan-usage-missing')).toBeTruthy();
    expect(getByTestId('settings-chatgpt-message')).toHaveTextContent('Sign-in timed out.');
  });
});
