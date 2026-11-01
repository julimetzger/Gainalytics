/**
 * GH-621: the "Analysis frame rate" setting reaches the native analysis as its 4th argument.
 */
const mockNativeAnalyze = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {VideoAnalysis: {analyzeSquatVideo: (...args: unknown[]) => mockNativeAnalyze(...args)}},
  Platform: {OS: 'android'},
}));

jest.mock('../videoAnalysisStorage', () => ({
  buildStubBarTrackingResult: jest.fn(),
  writeBarTrackingResultToFile: jest.fn(),
}));

import {analyzeSquatVideo} from '../videoAnalysisNative';

const SEED = {candidateId: 'c1', normalizedX: 0.3, normalizedY: 0.4, normalizedWidth: 0.12, normalizedHeight: 0.08};

describe('analyzeSquatVideo – analysis frame rate (GH-621)', () => {
  beforeEach(() => {
    mockNativeAnalyze.mockReset();
    mockNativeAnalyze.mockResolvedValue('/tmp/results/analysis-3.json');
  });

  it('passes the chosen frame rate to the native call', async () => {
    await expect(analyzeSquatVideo('content://media/1', 3, SEED, 15)).resolves.toBe('/tmp/results/analysis-3.json');

    expect(mockNativeAnalyze.mock.calls).toEqual([['content://media/1', 3, SEED, 15]]);
  });

  it('passes the default 30 when no frame rate is given', async () => {
    await analyzeSquatVideo('content://media/1', 3, SEED);

    expect(mockNativeAnalyze.mock.calls).toEqual([['content://media/1', 3, SEED, 30]]);
  });

  it('replaces an invalid frame rate with the default 30', async () => {
    // @ts-expect-error -- a corrupted persisted value must not reach the native side
    await analyzeSquatVideo('content://media/1', 3, undefined, 24);

    expect(mockNativeAnalyze.mock.calls).toEqual([['content://media/1', 3, null, 30]]);
  });

  it('falls back to the 3-argument call on an older native build', async () => {
    mockNativeAnalyze.mockRejectedValueOnce(new Error('VideoAnalysis.analyzeSquatVideo got 4 arguments, expected 3'));

    await analyzeSquatVideo('content://media/1', 3, SEED, 20);

    expect(mockNativeAnalyze.mock.calls).toEqual([
      ['content://media/1', 3, SEED, 20],
      ['content://media/1', 3, SEED],
    ]);
  });

  it('rethrows a real analysis error instead of retrying', async () => {
    mockNativeAnalyze.mockRejectedValueOnce(new Error('No outer_plate candidate detected at t=0'));

    await expect(analyzeSquatVideo('content://media/1', 3, SEED, 20)).rejects.toThrow('No outer_plate candidate');
    expect(mockNativeAnalyze).toHaveBeenCalledTimes(1);
  });
});
