import AsyncStorage from '@react-native-async-storage/async-storage';
import {MMKV} from 'react-native-mmkv';

export const storage = new MMKV();

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export const hasMigratedFromAsyncStorage = storage.getBoolean(
    'hasMigratedFromAsyncStorageAgain',
);

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export async function migrateFromAsyncStorage(): Promise<void> {
    const start = global.performance.now();

    const keys = await AsyncStorage.getAllKeys();
    storage.clearAll();

    for (const key of keys) {
        try {
            const value = await AsyncStorage.getItem(key);
            if (value != null) {
                if (['true', 'false'].includes(value)) {
                    storage.set(key, value === 'true');
                } else {
                    storage.set(key, value);
                }
            }
        } catch (error) {
            throw error;
        }
    }
    storage.set('hasMigratedFromAsyncStorageAgain', true);

    const end = global.performance.now();
}
