import {createMMKV} from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';
import {initSecureStore, secureStorage, toMmkvAes128Key} from '../../app/utils/secureStorage';

// The keychain holds a 64-hex-char key. react-native-mmkv v3 handed it to MMKV core, which only
// used the first 16 bytes for AES-128; v4 documents 16 bytes as the limit. The store must open
// with exactly those 16 bytes, otherwise an upgraded install could not read its API keys.
const KEYCHAIN_KEY = '0123456789abcdef'.repeat(4);

describe('secureStorage (react-native-mmkv v4)', () => {
  it('opens the existing secure-store with the 16-byte AES-128 key v3 effectively used', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({password: KEYCHAIN_KEY});

    await initSecureStore();

    expect(createMMKV).toHaveBeenCalledWith({id: 'secure-store', encryptionKey: '0123456789abcdef'});
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('removes the API key with remove() (v4 renamed delete)', () => {
    const store = (createMMKV as jest.Mock).mock.results.at(-1)!.value;
    secureStorage.deleteAnthropicApiKey();
    expect(store.remove).toHaveBeenCalledWith('anthropic_api_key');
  });

  it('toMmkvAes128Key keeps the first 16 chars and leaves short keys unchanged', () => {
    expect(toMmkvAes128Key(KEYCHAIN_KEY)).toBe('0123456789abcdef');
    expect(toMmkvAes128Key('short')).toBe('short');
  });
});
