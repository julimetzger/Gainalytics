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

// Per submit-button tap (GH-262). Captures user-perceived latency:
//   t1 - t0: JS thread free again (setTimeout 0 after the synchronous dispatch
//            cascade settles)
//   t2 - t0: checkmark visible (requestAnimationFrame, fires on the next React
//            commit/paint after the optimistic state change)
export interface SubmitRecord {
  ts: number;
  label: string; // 'planned-set' | 'add-set'
  t1MinusT0Ms: number;
  t2MinusT0Ms: number;
}

// React.Profiler onRender record (GH-267). One row per commit per Profiler.
// `id` is the Profiler tag set in <Profiler id="...">. `phase` is React's
// 'mount' | 'update' | 'nested-update'. Durations are React's own measure
// of the component-tree wall time during that commit.
export interface RenderRecord {
  ts: number;
  id: string;
  phase: string;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  lastActionType: string | null;
}

// Per-dispatch paint-gap record (GH-267). Decomposes the user-perceived
// latency into "synchronous reducer cost" vs "React commit + paint cost".
export interface PaintGapRecord {
  ts: number;
  actionType: string;
  dispatchEntryMs: number;
  dispatchReturnMs: number;
  paintObservedMs: number;
  gapMs: number;
}

// Per-call selector record from useTracedSelector (GH-267). Allows ranking
// selectors by total ms over a measurement window. `lastActionType` ties
// the record back to the dispatch that triggered react-redux's re-run.
export interface SelectorRecord {
  ts: number;
  name: string;
  ms: number;
  lastActionType: string | null;
}

class PerfRecorder {
  storage: StorageRecord[] = [];
  dispatch: DispatchRecord[] = [];
  submits: SubmitRecord[] = [];
  renders: RenderRecord[] = [];
  paintGaps: PaintGapRecord[] = [];
  selectors: SelectorRecord[] = [];
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

  recordSubmit(rec: SubmitRecord) {
    if (!this.enabled) return;
    this.submits.push(rec);
  }

  recordRender(rec: RenderRecord) {
    if (!this.enabled) return;
    this.renders.push(rec);
  }

  recordPaintGap(rec: PaintGapRecord) {
    if (!this.enabled) return;
    this.paintGaps.push(rec);
  }

  recordSelector(rec: SelectorRecord) {
    if (!this.enabled) return;
    this.selectors.push(rec);
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
    this.submits = [];
    this.renders = [];
    this.paintGaps = [];
    this.selectors = [];
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

  submitsCsv(): string {
    const header = 'ts_ms,label,t1_minus_t0_ms,t2_minus_t0_ms\n';
    const lines = this.submits.map(
      (r) =>
        `${r.ts},${r.label},${r.t1MinusT0Ms.toFixed(3)},${r.t2MinusT0Ms.toFixed(3)}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }

  rendersCsv(): string {
    const header =
      'ts_ms,id,phase,actual_duration_ms,base_duration_ms,start_time_ms,commit_time_ms,last_action_type\n';
    const lines = this.renders.map(
      (r) =>
        `${r.ts},${r.id},${r.phase},${r.actualDuration.toFixed(3)},${r.baseDuration.toFixed(3)},${r.startTime.toFixed(3)},${r.commitTime.toFixed(3)},${r.lastActionType ?? ''}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }

  paintGapCsv(): string {
    const header =
      'ts_ms,action_type,dispatch_entry_ms,dispatch_return_ms,paint_observed_ms,gap_ms\n';
    const lines = this.paintGaps.map(
      (r) =>
        `${r.ts},${r.actionType},${r.dispatchEntryMs.toFixed(3)},${r.dispatchReturnMs.toFixed(3)},${r.paintObservedMs.toFixed(3)},${r.gapMs.toFixed(3)}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }

  selectorCsv(): string {
    const header = 'ts_ms,name,ms,last_action_type\n';
    const lines = this.selectors.map(
      (r) => `${r.ts},${r.name},${r.ms.toFixed(3)},${r.lastActionType ?? ''}`,
    );
    return header + lines.join('\n') + (lines.length ? '\n' : '');
  }
}

export const perfRecorder = new PerfRecorder();
