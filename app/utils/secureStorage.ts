/**
 * Secure storage for sensitive values (e.g. API keys).
 * Uses react-native-mmkv with encryption — values are NOT stored in Redux or AsyncStorage.
 */
import {MMKV} from 'react-native-mmkv';

// Dedicated encrypted MMKV instance for sensitive data
const secureStore = new MMKV({
  id: 'secure-store',
  encryptionKey: 'gainalytics-secure-v1',
});

const ANTHROPIC_API_KEY = 'anthropic_api_key';

export const secureStorage = {
  getAnthropicApiKey(): string | undefined {
    return secureStore.getString(ANTHROPIC_API_KEY);
  },

  setAnthropicApiKey(key: string): void {
    secureStore.set(ANTHROPIC_API_KEY, key);
  },

  deleteAnthropicApiKey(): void {
    secureStore.delete(ANTHROPIC_API_KEY);
  },

  hasAnthropicApiKey(): boolean {
    return secureStore.contains(ANTHROPIC_API_KEY);
  },
};
