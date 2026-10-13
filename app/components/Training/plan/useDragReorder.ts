import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {Animated, LayoutChangeEvent} from 'react-native';
import {Gesture} from 'react-native-gesture-handler';
import type {PanGesture} from 'react-native-gesture-handler';
import {useNestableScrollContainerContext} from 'react-native-draggable-flatlist';
import {ScrollController, useScrollController} from '../../common/KeyboardAwareScrollView';

/**
 * GH-418: drag-to-reorder for the plan editor's exercise sections and set rows.
 *
 * GH-324 replaced NestableDraggableFlatList here with a pan on a drag handle (the
 * library list broke Fabric drawing in this screen, see PlanEditList). That drag
 * worked, but the audit found it hard to use: the list did not scroll along, so an
 * item could only move within the visible part of the plan, and on release the
 * item snapped back and the list re-rendered in its new order, with nothing showing
 * where it was going to land. This hook adds the three missing parts:
 * - auto-scroll: holding the item near the top or bottom edge scrolls the plan,
 * - a gap: the other items move aside while dragging, and a placeholder outlines
 *   the slot the item will drop into,
 * - snapping: on release the item animates into that slot before the new order is
 *   committed.
 *
 * Still the core react-native Animated API, for the reason given in PlanEditList:
 * a reanimated transform in this position stopped Fabric from drawing the
 * following siblings. The dragged item follows the finger with `setValue` from the
 * gesture callbacks; every timed animation (making room, settling) runs on the
 * native driver, because the JS thread is busy with the gesture and a large plan.
 */

/** Distance from the visible top/bottom edge at which the list starts to scroll along, in dp. */
export const AUTO_SCROLL_EDGE = 80;
/**
 * Scroll speed at the very edge, in dp per second. Time-based rather than per
 * frame: a busy JS thread delivers fewer frames, and the list must still move at
 * the speed the finger asks for.
 */
export const AUTO_SCROLL_MAX_SPEED = 900;
/**
 * Longest frame gap that is still scrolled at full speed. A large plan keeps the JS
 * thread busy during a drag, and frames then arrive only a few times per second;
 * the cap only stops a real stall (e.g. a GC pause) from jumping the list.
 */
const MAX_FRAME_GAP_MS = 250;
/** How long the other items take to make room for the dragged one. */
const SHIFT_DURATION_MS = 150;
/** How long the released item takes to settle into its slot. */
const DROP_DURATION_MS = 180;
/** Fallback: reset the drag visuals even if the parent never re-renders with a new order. */
const RESET_FALLBACK_MS = 600;

/**
 * GH-324: given the drop displacement of a dragged item, find the index it should
 * land on. Walks neighbouring item heights until less than half of the next item
 * remains — the drop then "belongs" to that slot.
 */
export function resolveSectionTargetIndex(index: number, translationY: number, heights: Record<number, number>, count: number): number {
  let target = index;
  let remaining = translationY;
  if (translationY > 0) {
    while (target < count - 1) {
      const nextHeight = heights[target + 1] ?? 0;
      if (nextHeight <= 0 || remaining < nextHeight / 2) {
        break;
      }
      remaining -= nextHeight;
      target += 1;
    }
  } else {
    while (target > 0) {
      const prevHeight = heights[target - 1] ?? 0;
      if (prevHeight <= 0 || -remaining < prevHeight / 2) {
        break;
      }
      remaining += prevHeight;
      target -= 1;
    }
  }
  return target;
}

/** How far an item at `itemIndex` moves to make room while `index` hovers over `target`. */
export function shiftForItem(itemIndex: number, index: number, target: number, draggedHeight: number): number {
  if (index < itemIndex && itemIndex <= target) {
    return -draggedHeight;
  }
  if (target <= itemIndex && itemIndex < index) {
    return draggedHeight;
  }
  return 0;
}

/** Where the dragged item's slot is once it drops on `target`, relative to where it started. */
export function dropOffset(index: number, target: number, heights: Record<number, number>): number {
  let offset = 0;
  if (target > index) {
    for (let i = index + 1; i <= target; i += 1) {
      offset += heights[i] ?? 0;
    }
  } else {
    for (let i = target; i < index; i += 1) {
      offset -= heights[i] ?? 0;
    }
  }
  return offset;
}

/**
 * Scroll step for a finger at window y `fingerY`: 0 in the middle, growing towards
 * the edge, negative near the top. Proportional, so the user controls the speed by
 * how far into the edge zone they hold the item.
 */
export function autoScrollSpeed(fingerY: number, visible: {top: number; bottom: number}): number {
  // In dp per second, see AUTO_SCROLL_MAX_SPEED.
  const height = visible.bottom - visible.top;
  // A tiny visible area (keyboard open on a small screen) must not be all edge.
  const edge = Math.min(AUTO_SCROLL_EDGE, height / 3);
  if (edge <= 0) {
    return 0;
  }
  if (fingerY < visible.top + edge) {
    return -AUTO_SCROLL_MAX_SPEED * Math.min(1, (visible.top + edge - fingerY) / edge);
  }
  if (fingerY > visible.bottom - edge) {
    return AUTO_SCROLL_MAX_SPEED * Math.min(1, (fingerY - (visible.bottom - edge)) / edge);
  }
  return 0;
}

export interface DragItemBinding {
  translateY: Animated.Value;
  gesture: PanGesture;
  onLayout: (event: LayoutChangeEvent) => void;
}

export interface DragPlaceholder {
  /** Offset from the top of the list, as a transform (native-driver friendly). */
  translateY: Animated.Value;
  height: number;
}

interface DragSession {
  index: number;
  startOffset: number;
  absoluteY: number;
  translationY: number;
  target: number;
  frame: number | null;
  lastFrameTime: number | null;
}

interface UseDragReorderOptions {
  count: number;
  /** Changes identity when the parent re-renders the list in a new order — the moment to drop the drag offsets. */
  items: unknown;
  onReorder: (from: number, to: number) => void;
}

export interface DragReorder {
  activeIndex: number | null;
  /** Outline of the slot the dragged item will land in, while a drag is in flight. */
  placeholder: DragPlaceholder | null;
  bind: (index: number) => DragItemBinding;
}

export function useDragReorder({count, items, onReorder}: UseDragReorderOptions): DragReorder {
  const nestableScrollContext = useNestableScrollContainerContext();
  const scrollController = useScrollController();
  const scrollControllerRef = useRef<ScrollController | null>(scrollController);
  scrollControllerRef.current = scrollController;
  const nestableScrollContextRef = useRef(nestableScrollContext);
  nestableScrollContextRef.current = nestableScrollContext;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const countRef = useRef(count);
  countRef.current = count;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const placeholderTopRef = useRef(new Animated.Value(0));
  const translateValuesRef = useRef<Animated.Value[]>([]);
  const shiftsRef = useRef<number[]>([]);
  const heightsRef = useRef<Record<number, number>>({});
  const topsRef = useRef<Record<number, number>>({});
  const sessionRef = useRef<DragSession | null>(null);
  const awaitingReorderRef = useRef(false);
  // From the release until the drop is committed (or glided back) no new drag may
  // start: the settle animation's callback commits the OLD drop, and the parent's
  // re-render with that order would reset the offsets under a newer drag. Rapid
  // drags then landed in the wrong order or tore the second drag apart.
  const dropPendingRef = useRef(false);
  const resetFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesturesRef = useRef<Map<number, PanGesture>>(new Map());
  const gestureCountRef = useRef(count);

  const valueAt = (index: number) => {
    let value = translateValuesRef.current[index];
    if (value === undefined) {
      value = new Animated.Value(0);
      translateValuesRef.current[index] = value;
    }
    return value;
  };

  const resetVisuals = useCallback(() => {
    if (resetFallbackRef.current !== null) {
      clearTimeout(resetFallbackRef.current);
      resetFallbackRef.current = null;
    }
    awaitingReorderRef.current = false;
    dropPendingRef.current = false;
    translateValuesRef.current.forEach((value) => value.setValue(0));
    shiftsRef.current = [];
    setActiveIndex(null);
    setPlaceholderHeight(null);
  }, []);

  // The parent re-renders with the new order: the items now sit in their new
  // slots by layout, so the offsets that carried them there must go in the SAME
  // commit. Resetting them afterwards (setValue in an effect) reaches native later
  // than the new layout, and for a moment every moved item was offset twice. So the
  // render that carries the new order hands out fresh, zeroed values instead.
  const lastItemsRef = useRef(items);
  const droppedRef = useRef(false);
  if (items !== lastItemsRef.current) {
    lastItemsRef.current = items;
    if (awaitingReorderRef.current) {
      awaitingReorderRef.current = false;
      translateValuesRef.current = [];
      shiftsRef.current = [];
      droppedRef.current = true;
    }
  }
  useLayoutEffect(() => {
    if (droppedRef.current) {
      droppedRef.current = false;
      resetVisuals();
    }
  });

  const moveShifts = (session: DragSession) => {
    const draggedHeight = heightsRef.current[session.index] ?? 0;
    for (let itemIndex = 0; itemIndex < countRef.current; itemIndex += 1) {
      if (itemIndex === session.index) {
        continue;
      }
      const shift = shiftForItem(itemIndex, session.index, session.target, draggedHeight);
      if ((shiftsRef.current[itemIndex] ?? 0) === shift) {
        continue;
      }
      shiftsRef.current[itemIndex] = shift;
      Animated.timing(valueAt(itemIndex), {toValue: shift, duration: SHIFT_DURATION_MS, useNativeDriver: true}).start();
    }
    const startTop = topsRef.current[session.index] ?? 0;
    Animated.timing(placeholderTopRef.current, {
      toValue: startTop + dropOffset(session.index, session.target, heightsRef.current),
      duration: SHIFT_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  /** Places the dragged item under the finger and re-evaluates where it would land. */
  const followFinger = () => {
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    const scrolledBy = (scrollControllerRef.current?.getOffset() ?? session.startOffset) - session.startOffset;
    const displacement = session.translationY + scrolledBy;
    valueAt(session.index).setValue(displacement);
    const target = resolveSectionTargetIndex(session.index, displacement, heightsRef.current, countRef.current);
    if (target !== session.target) {
      session.target = target;
      moveShifts(session);
    }
  };

  const autoScrollTick = (frameTime: number) => {
    const session = sessionRef.current;
    const controller = scrollControllerRef.current;
    if (session === null) {
      return;
    }
    session.frame = null;
    const elapsedMs = session.lastFrameTime === null ? 0 : Math.min(MAX_FRAME_GAP_MS, Math.max(0, frameTime - session.lastFrameTime));
    session.lastFrameTime = frameTime;
    const visible = controller?.getVisibleWindowRect() ?? null;
    if (controller !== null && visible !== null && elapsedMs > 0) {
      const speed = autoScrollSpeed(session.absoluteY, visible);
      if (speed !== 0) {
        const offset = controller.getOffset();
        const next = Math.max(0, Math.min(controller.getMaxOffset(), offset + (speed * elapsedMs) / 1000));
        if (Math.abs(next - offset) >= 0.5) {
          controller.scrollTo(next);
          followFinger();
        }
      }
    }
    session.frame = requestAnimationFrame(autoScrollTick);
  };

  const startDrag = (index: number, absoluteY: number) => {
    if (dropPendingRef.current) {
      // The previous drop is still settling — this touch does not start a drag.
      return;
    }
    sessionRef.current = {
      index,
      startOffset: scrollControllerRef.current?.getOffset() ?? 0,
      absoluteY,
      translationY: 0,
      target: index,
      frame: null,
      lastFrameTime: null,
    };
    shiftsRef.current = [];
    placeholderTopRef.current.setValue(topsRef.current[index] ?? 0);
    setPlaceholderHeight(heightsRef.current[index] ?? 0);
    setActiveIndex(index);
    nestableScrollContextRef.current?.setOuterScrollEnabled(false);
    sessionRef.current.frame = requestAnimationFrame(autoScrollTick);
  };

  const endDrag = (success: boolean) => {
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    sessionRef.current = null;
    if (session.frame !== null) {
      cancelAnimationFrame(session.frame);
    }
    nestableScrollContextRef.current?.setOuterScrollEnabled(true);
    dropPendingRef.current = true;
    const target = success ? session.target : session.index;
    if (target === session.index) {
      // Dropped where it came from: everything glides back.
      shiftsRef.current = [];
      Animated.parallel(
        translateValuesRef.current.map((value) => Animated.timing(value, {toValue: 0, duration: DROP_DURATION_MS, useNativeDriver: true})),
      ).start(resetVisuals);
      return;
    }
    Animated.timing(valueAt(session.index), {
      toValue: dropOffset(session.index, target, heightsRef.current),
      duration: DROP_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      awaitingReorderRef.current = true;
      resetFallbackRef.current = setTimeout(resetVisuals, RESET_FALLBACK_MS);
      onReorderRef.current(session.index, target);
    });
  };

  const gestureFor = (index: number): PanGesture => {
    if (gestureCountRef.current !== count) {
      gestureCountRef.current = count;
      gesturesRef.current = new Map();
    }
    const cached = gesturesRef.current.get(index);
    if (cached !== undefined) {
      return cached;
    }
    const gesture = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-4, 4])
      .onStart((event) => {
        startDrag(index, event.absoluteY);
      })
      .onUpdate((event) => {
        const session = sessionRef.current;
        if (session === null || session.index !== index) {
          return;
        }
        session.translationY = event.translationY;
        session.absoluteY = event.absoluteY;
        followFinger();
      })
      .onFinalize((_event, success) => {
        if (sessionRef.current?.index === index) {
          endDrag(success);
        }
      });
    gesturesRef.current.set(index, gesture);
    return gesture;
  };

  const bind = (index: number): DragItemBinding => ({
    translateY: valueAt(index),
    gesture: gestureFor(index),
    onLayout: (event: LayoutChangeEvent) => {
      heightsRef.current[index] = event.nativeEvent.layout.height;
      topsRef.current[index] = event.nativeEvent.layout.y;
    },
  });

  const dropped = droppedRef.current;
  return {
    activeIndex: dropped ? null : activeIndex,
    placeholder: dropped || placeholderHeight === null ? null : {translateY: placeholderTopRef.current, height: placeholderHeight},
    bind,
  };
}
