import {__DEV_PERF__} from './devPerfFlag';

// Two CSV streams:
//   - storage rows: one per redux-persist setItem/getItem
//   - dispatch rows: one per redux action (entry-to-next-tick latency)
// Buffered in memory. Dumped to disk by SettingsTab (or via the redux
// thunk in dispatchDumpPerfCsv) on user request. NEVER dumped automatically.

export type StorageOp = 'setItem' | 'getItem' | 'removeItem';

export interface StorageRecord {
  ts: number; // ms since epoch
  op: StorageOp;
  key: string;
  bytes: number; // payload length (chars). 0 for getItem misses
  jsonMs: number; // upstream JSON.stringify cost charged to this write (-1 if not measured)
  mmkvMs: number; // MMKV native call cost
  lastActionType: string | null; // best-effort: action type that was the most recent reducer call
}

export interface DispatchRecord {
  ts: number;
  actionType: string;
  reducerMs: number; // reducer (sync part of dispatch) wall time
  totalMs: number; // dispatch entry → next macrotask (covers immediate persist debounce)
  bytesWrittenInTick: number; // sum of bytes written by reduxStorage.setItem in the same tick
  setItemCallsInTick: number;
  hardSetCount: number; // count of REHYDRATE in same tick (proxy for the REHYDRATE write storm)
}

class PerfRecorder {
  storage: StorageRecord[] = [];
  dispatch: DispatchRecord[] = [];
  lastActionType: string | null = null;
  // tick scratch (cleared on each dispatch start)
  tickBytes = 0;
  tickSetItemCalls = 0;
  tickHardSet = 0;
  startedAt = Date.now();
  enabled = __DEV_PERF__;

  recordStorage(rec: StorageRecord) {
    if (!this.enabled) return;
    this.storage.push(rec);
    if (rec.op === 'setItem') {
      this.tickBytes += rec.bytes;
      this.tickSetItemCalls += 1;
    }
  }

  recordDispatch(rec: DispatchRecord) {
    if (!this.enabled) return;
    this.dispatch.push(rec);
  }

  noteAction(type: string) {
    if (!this.enabled) return;
    this.lastActionType = type;
    if (type === 'persist/REHYDRATE') {
      this.tickHardSet += 1;
    }
  }

  resetTick() {
    this.tickBytes = 0;
    this.tickSetItemCalls = 0;
    this.tickHardSet = 0;
  }

  reset() {
    this.storage = [];
    this.dispatch = [];
    this.lastActionType = null;
    this.tickBytes = 0;
    this.tickSetItemCalls = 0;
    this.tickHardSet = 0;
    this.startedAt = Date.now();
  }

  storageCsv(): string {
    const header = 'ts_ms,op,key,bytes,json_ms,mmkv_ms,last_action_type\n';
    const lines = this.storage.map(
      (r) =>
        `${r.ts},${r.op},${r.key},${r.bytes},${r.jsonMs.toFixed(3)},${r.mmkvMs.toFixed(
          3,
        )},${r.lastActionType ?? ''}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }

  dispatchCsv(): string {
    const header =
      'ts_ms,action_type,reducer_ms,total_ms,bytes_written_in_tick,set_item_calls_in_tick,hardset_count\n';
    const lines = this.dispatch.map(
      (r) =>
        `${r.ts},${r.actionType},${r.reducerMs.toFixed(3)},${r.totalMs.toFixed(3)},${r.bytesWrittenInTick},${r.setItemCallsInTick},${r.hardSetCount}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }
}

export const perfRecorder = new PerfRecorder();
