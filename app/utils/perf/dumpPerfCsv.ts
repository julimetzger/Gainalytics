import {Alert} from 'react-native';
import {__DEV_PERF__} from './devPerfFlag';
import {perfRecorder} from './perfRecorder';

// Writes the buffered storage + dispatch CSVs to the device Download dir.
// Filenames carry a label (e.g. "cold-start", "plan-training-r1") so each
// measurement run is easy to pull/cluster.
export async function dumpPerfCsv(label: string): Promise<string[]> {
  if (!__DEV_PERF__) return [];
  // require lazily so the dependency only loads when the gate is on
  const RNFS = require('react-native-fs');
  const stamp = `${perfRecorder.startedAt}-${Date.now()}`;
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  // ExternalDirectoryPath -> /storage/emulated/0/Android/data/<pkg>/files
  // No scoped-storage prompt; adb can pull from this path on a debug build.
  const dir = RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath;
  const storagePath = `${dir}/perf-${safeLabel}-storage-${stamp}.csv`;
  const dispatchPath = `${dir}/perf-${safeLabel}-dispatch-${stamp}.csv`;
  await RNFS.writeFile(storagePath, perfRecorder.storageCsv(), 'utf8');
  await RNFS.writeFile(dispatchPath, perfRecorder.dispatchCsv(), 'utf8');
  Alert.alert(
    'Perf CSV dumped',
    `${storagePath}\n${dispatchPath}\n\nstorage rows: ${perfRecorder.storage.length}\ndispatch rows: ${perfRecorder.dispatch.length}`,
  );
  return [storagePath, dispatchPath];
}

export function resetPerfCsv() {
  if (!__DEV_PERF__) return;
  perfRecorder.reset();
  Alert.alert('Perf buffers reset', 'Storage + dispatch CSVs cleared.');
}
