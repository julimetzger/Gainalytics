/**
 * GH-504: the provider choice in Settings → AI Coach. ChatGPT is only offered where the
 * native sign-in exists (Android); elsewhere (iOS) it is disabled with a hint.
 */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import AiProviderSelector from '../../../app/components/settings/AiProviderSelector';

let mockLoopbackAvailable = true;
jest.mock('../../../app/utils/ai/chatgpt/chatgptSession', () => ({
  isLoopbackAvailable: () => mockLoopbackAvailable,
}));
jest.mock('../../../app/redux/settings/use/useAiProvider', () => ({
  useAiProvider: () => 'claude',
}));
const mockSetProvider = jest.fn();
jest.mock('../../../app/redux/settings/dispatch/dispatchSetAiProvider', () => ({
  dispatchSetAiProvider: () => mockSetProvider,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLoopbackAvailable = true;
});

describe('AiProviderSelector', () => {
  it('lets the user pick ChatGPT where the sign-in is supported', () => {
    const {getByTestId, queryByTestId} = render(<AiProviderSelector />);

    fireEvent.press(getByTestId('settings-ai-provider-chatgpt'));

    expect(mockSetProvider).toHaveBeenCalledWith('chatgpt');
    expect(queryByTestId('settings-ai-provider-chatgpt-unavailable')).toBeNull();
  });

  it('disables ChatGPT with a hint where the sign-in is not available (iOS)', () => {
    mockLoopbackAvailable = false;
    const {getByTestId} = render(<AiProviderSelector />);

    fireEvent.press(getByTestId('settings-ai-provider-chatgpt'));

    expect(mockSetProvider).not.toHaveBeenCalled();
    expect(getByTestId('settings-ai-provider-chatgpt-unavailable')).toHaveTextContent(
      'Sign in with ChatGPT is only available on Android for now.',
    );
  });
});
