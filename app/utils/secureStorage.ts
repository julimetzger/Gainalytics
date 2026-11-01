/**
 * Secure storage for sensitive values (e.g. API keys).
 * Uses react-native-mmkv with a per-device encryption key stored in Android Keystore / iOS Keychain.
 * Values are NOT stored in Redux or AsyncStorage.
 */
import {createMMKV, type MMKV} from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'gainalytics-secure-store';
const KEYCHAIN_USERNAME = 'mmkv-encryption-key';

// In-memory reference to the lazy-initialised MMKV instance.
let _store: MMKV | null = null;

// Subscribers for API key changes (allows reactive hooks without Redux).
const _apiKeyListeners = new Set<() => void>();

/**
 * Returns a hex string of N random bytes.
 */
function generateHexKey(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The keychain key is 64 hex chars, but MMKV's AES-128 only ever used the first 16 bytes
 * (MMKV core truncates the key). react-native-mmkv v4 documents 16 bytes as the AES-128 limit,
 * so pass exactly those 16 bytes: the same key the existing v3 store was encrypted with.
 */
export function toMmkvAes128Key(encryptionKey: string): string {
  return encryptionKey.slice(0, 16);
}

/**
 * Retrieves or creates the per-device MMKV encryption key, stored in the platform keychain.
 * Must be called (and awaited) on app start before any component uses secureStorage.
 */
export async function initSecureStore(): Promise<void> {
  if (_store) return;

  let encryptionKey: string;

  try {
    const existing = await Keychain.getGenericPassword({service: KEYCHAIN_SERVICE});
    if (existing && existing.password) {
      encryptionKey = existing.password;
    } else {
      encryptionKey = generateHexKey(32);
      await Keychain.setGenericPassword(KEYCHAIN_USERNAME, encryptionKey, {
        service: KEYCHAIN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Keychain unavailable (e.g. unit-test environment) — use a random key so the app doesn't crash.
    encryptionKey = generateHexKey(32);
  }

  _store = createMMKV({
    id: 'secure-store',
    encryptionKey: toMmkvAes128Key(encryptionKey),
  });
}

function getStore(): MMKV {
  if (!_store) {
    throw new Error(
      'secureStorage: store not initialised. Call initSecureStore() on app start.',
    );
  }
  return _store;
}

/** Encrypted store for other sensitive values (GH-504 ChatGPT PoC session). */
export function getSecureStore(): MMKV {
  return getStore();
}

/** Allow tests to inject a pre-built MMKV instance without Keychain. */
export function setStoreForTesting(store: MMKV): void {
  _store = store;
}

/**
 * Subscribe to API key changes. Returns an unsubscribe function.
 * Useful for keeping React components in sync without Redux.
 */
export function subscribeToApiKeyChanges(callback: () => void): () => void {
  _apiKeyListeners.add(callback);
  return () => _apiKeyListeners.delete(callback);
}

function notifyApiKeyListeners(): void {
  _apiKeyListeners.forEach(cb => cb());
}

const ANTHROPIC_API_KEY = 'anthropic_api_key';

export const secureStorage = {
  getAnthropicApiKey(): string | undefined {
    return getStore().getString(ANTHROPIC_API_KEY);
  },

  setAnthropicApiKey(key: string): void {
    getStore().set(ANTHROPIC_API_KEY, key);
    notifyApiKeyListeners();
  },

  deleteAnthropicApiKey(): void {
    getStore().remove(ANTHROPIC_API_KEY);
    notifyApiKeyListeners();
  },

  hasAnthropicApiKey(): boolean {
    return getStore().contains(ANTHROPIC_API_KEY);
  },
};
