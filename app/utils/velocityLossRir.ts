/**
 * Shared utility for Velocity Loss → RIR mapping and discrepancy detection.
 * Extracted from VideoAnalysisPlaybackOverlayCard (heuristic v1, issue #66).
 *
 * The global curve below is the fallback for every exercise. An exercise can
 * additionally carry a VL reference (issue #316): one set with a confirmed RIR
 * that scales the thresholds for that exercise only. Everything here degrades to
 * the untouched global curve when no reference is passed.
 */
import {VelocityLossReference} from '../models/entities/Exercise';

/** Global VL% cut-offs between the RIR bands below. Never modified by a reference. */
export const GLOBAL_VL_THRESHOLDS: readonly number[] = [10, 20, 30, 40];

/** RIR bands, ordered from lowest to highest velocity loss. */
export const RIR_BANDS: readonly string[] = ['4+', '3-4', '2-3', '1-2', '0-1'];

/** Only a deep enough set is a usable anchor — beyond RIR 3 the VL signal is noise. */
export const MIN_REFERENCE_RIR = 0;
export const MAX_REFERENCE_RIR = 3;

/** RIR values that may anchor a VL reference, deepest first. */
export const REFERENCE_RIR_OPTIONS: readonly number[] = [0, 1, 2, 3];

/** True when `rir` is an integer inside the allowed anchor range. */
export function isValidReferenceRir(rir: number | undefined | null): boolean {
  return rir != null && Number.isInteger(rir) && rir >= MIN_REFERENCE_RIR && rir <= MAX_REFERENCE_RIR;
}

/**
 * Index of the band that represents `rir` on the global curve.
 * RIR 3 → '3-4', RIR 2 → '2-3', RIR 1 → '1-2', RIR 0 → '0-1'.
 */
function bandIndexForReferenceRir(rir: number): number {
  return RIR_BANDS.length - 1 - rir;
}

/**
 * VL% at the centre of the band that represents `rir` on the global curve.
 * This is the VL the global curve "expects" for that RIR: 3 → 15%, 2 → 25%,
 * 1 → 35%, 0 → 45%. The open-ended top band uses the width of the band below it.
 */
export function globalAnchorVlPercent(rir: number): number | null {
  if (!isValidReferenceRir(rir)) {
    return null;
  }
  const index = bandIndexForReferenceRir(rir);
  const lastIndex = GLOBAL_VL_THRESHOLDS.length;
  if (index === lastIndex) {
    const lastThreshold = GLOBAL_VL_THRESHOLDS[lastIndex - 1];
    const previousThreshold = GLOBAL_VL_THRESHOLDS[lastIndex - 2];
    return lastThreshold + (lastThreshold - previousThreshold) / 2;
  }
  const upper = GLOBAL_VL_THRESHOLDS[index];
  const lower = index === 0 ? 0 : GLOBAL_VL_THRESHOLDS[index - 1];
  return (lower + upper) / 2;
}

/**
 * Factor by which the global thresholds are stretched for a referenced exercise.
 * An athlete who only loses 14% at RIR 1 (global expectation: 35%) gets a factor
 * of 0.41, i.e. every band boundary moves down proportionally.
 *
 * Returns null when the reference cannot produce a usable curve — callers then
 * fall back to the global thresholds.
 */
export function vlReferenceScaleFactor(reference?: VelocityLossReference): number | null {
  if (!reference || !isValidReferenceRir(reference.rir)) {
    return null;
  }
  const measured = reference.velocityLossPercent;
  if (!Number.isFinite(measured) || measured <= 0) {
    return null;
  }
  const anchor = globalAnchorVlPercent(reference.rir);
  if (anchor === null || anchor <= 0) {
    return null;
  }
  return measured / anchor;
}

/** The VL% cut-offs in effect for an exercise — scaled when it has a usable reference. */
export function vlThresholdsFor(reference?: VelocityLossReference): number[] {
  const scale = vlReferenceScaleFactor(reference);
  if (scale === null) {
    return [...GLOBAL_VL_THRESHOLDS];
  }
  return GLOBAL_VL_THRESHOLDS.map((threshold) => threshold * scale);
}

/** True when `reference` actually changes the curve for its exercise. */
export function isVlReferenceActive(reference?: VelocityLossReference): boolean {
  return vlReferenceScaleFactor(reference) !== null;
}

/**
 * Maps a velocity-loss percentage to a RIR estimate string.
 * Without a reference this is the untouched global heuristic v1.
 */
export function vlToRirEstimate(velocityLossPercent: number, reference?: VelocityLossReference): string {
  const thresholds = vlThresholdsFor(reference);
  for (let index = 0; index < thresholds.length; index += 1) {
    if (velocityLossPercent < thresholds[index]) {
      return RIR_BANDS[index];
    }
  }
  return RIR_BANDS[RIR_BANDS.length - 1];
}

/**
 * Returns true if the reported RIR falls outside the VL-based RIR range.
 * A discrepancy indicates the athlete's perceived effort differs from the
 * velocity-derived effort estimate. Uses the referenced thresholds when the
 * exercise is referenced, so a calibrated athlete is not warned about their own anchor.
 */
export function hasRirDiscrepancy(reportedRir: number, velocityLossPercent: number, reference?: VelocityLossReference): boolean {
  const estimate = vlToRirEstimate(velocityLossPercent, reference);
  switch (estimate) {
    case '4+':
      return reportedRir < 4;
    case '3-4':
      return reportedRir < 3 || reportedRir > 4;
    case '2-3':
      return reportedRir < 2 || reportedRir > 3;
    case '1-2':
      return reportedRir < 1 || reportedRir > 2;
    case '0-1':
      return reportedRir < 0 || reportedRir > 1;
    default:
      return false;
  }
}

/** Short "Referenced · <date>" label for a referenced exercise, or null when there is none. */
export function formatVlReferenceLabel(reference?: VelocityLossReference, locale?: string): string | null {
  if (!isVlReferenceActive(reference)) {
    return null;
  }
  const date = new Date(reference!.referencedAt);
  const dateLabel = Number.isNaN(date.getTime()) ? reference!.referencedAt : date.toLocaleDateString(locale);
  return `VL reference · RIR ${reference!.rir} · ${dateLabel}`;
}
