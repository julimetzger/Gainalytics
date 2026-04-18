import {Meso} from '../models/entities/TrainingsPlan';
import {getMesoForMicro, getLocalMicro} from '../redux/Training/trainingsPlanReducer';

function stripUmlauts(str: string): string {
  return str
    .replace(/[äÄ]/g, (c) => (c === 'ä' ? 'a' : 'A'))
    .replace(/[öÖ]/g, (c) => (c === 'ö' ? 'o' : 'O'))
    .replace(/[üÜ]/g, (c) => (c === 'ü' ? 'u' : 'U'))
    .replace(/ß/g, 'S');
}

/**
 * Returns the display label for a micro in the Training History.
 * Format: <MesoInitial><LocalMicroIndex>, e.g. "A3", "R1", "I2".
 * Falls back to the global micro number as a string when no meso is found.
 */
export function getMicroLabel(mesos: Meso[] | undefined, globalMicro: number): string {
  const meso = getMesoForMicro(mesos, globalMicro);
  if (!meso) return String(globalMicro);
  const initial = stripUmlauts(meso.name.trim()).charAt(0).toUpperCase();
  const localIndex = getLocalMicro(mesos, globalMicro);
  return `${initial}${localIndex}`;
}
