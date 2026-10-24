import {NativeModules} from 'react-native';

/**
 * GH-496: the CSV export hands its file to the native `FileShare` module (Android share sheet
 * with "Save to Downloads"). iOS has no such module yet, so the export is unavailable there
 * rather than leaving the file in the app's cache, which the user cannot reach.
 */
export const isStrongCsvShareAvailable = (): boolean => typeof NativeModules.FileShare?.shareFile === 'function';
