// The owner's manual Garmin figures (T153, FR-069): the latest entry is current, per distance for
// predictions, and an absent file means "not recorded yet".
import { describe, expect, it } from 'vitest';
import {
  latestManualMetrics,
  predictionDistanceFor,
  predictionHistory,
  trainingStatusHistory,
  type ManualMetrics,
} from '../../src/sections/running/domain/manual-metrics.ts';

const EMPTY: ManualMetrics = { training_status: [], race_predictions: [] };

describe('latestManualMetrics', () => {
  it('picks the latest as_of entry, whatever order the file lists them in', () => {
    const metrics: ManualMetrics = {
      training_status: [
        { as_of: '2027-03-01', status: 'productive' },
        { as_of: '2027-03-15', status: 'peaking', note: 'Taper week' },
        { as_of: '2027-02-01', status: 'maintaining' },
      ],
      race_predictions: [
        { as_of: '2027-03-01', '5k': '20:47' },
        { as_of: '2026-12-01', '5k': '21:30' },
      ],
    };
    const current = latestManualMetrics(metrics);
    expect(current.trainingStatus).toEqual({ status: 'peaking', label: 'Peaking', note: 'Taper week', as_of: '2027-03-15' });
    expect(current.predictions['5k']).toEqual({ distance: '5k', time: '20:47', seconds: 1247, as_of: '2027-03-01' });
  });

  it('keeps the latest prediction per distance when entries cover different distances', () => {
    const metrics: ManualMetrics = {
      training_status: [],
      race_predictions: [
        { as_of: '2027-01-10', '5k': '20:10', '10k': '42:00', half: '1:33:00', marathon: '3:20:00' },
        { as_of: '2027-02-20', '5k': '19:55' },
        { as_of: '2027-03-01', marathon: '3:18:30' },
      ],
    };
    const { predictions } = latestManualMetrics(metrics);
    expect(predictions['5k']).toMatchObject({ time: '19:55', as_of: '2027-02-20' });
    expect(predictions['10k']).toMatchObject({ time: '42:00', as_of: '2027-01-10' });
    expect(predictions.half).toMatchObject({ time: '1:33:00', as_of: '2027-01-10' });
    expect(predictions.marathon).toMatchObject({ time: '3:18:30', seconds: 11910, as_of: '2027-03-01' });
  });

  it('says nothing is recorded yet for an empty or absent file', () => {
    expect(latestManualMetrics(EMPTY)).toEqual({ trainingStatus: undefined, predictions: {} });
  });
});

describe('history (the trend)', () => {
  it('lists entries oldest first, skipping entries without the distance', () => {
    const metrics: ManualMetrics = {
      training_status: [
        { as_of: '2027-02-01', status: 'recovery' },
        { as_of: '2027-01-01', status: 'no_status' },
      ],
      race_predictions: [
        { as_of: '2027-03-01', '10k': '41:00' },
        { as_of: '2027-02-01', '5k': '20:00' },
        { as_of: '2027-01-01', '10k': '42:30' },
      ],
    };
    expect(predictionHistory(metrics, '10k').map((p) => [p.as_of, p.seconds])).toEqual([
      ['2027-01-01', 2550],
      ['2027-03-01', 2460],
    ]);
    expect(trainingStatusHistory(metrics).map((s) => s.label)).toEqual(['No status', 'Recovery']);
    expect(predictionHistory(EMPTY, 'half')).toEqual([]);
  });
});

describe('predictionDistanceFor', () => {
  it('maps goal distances Garmin predicts, within half a metre', () => {
    expect(predictionDistanceFor(5000)).toBe('5k');
    expect(predictionDistanceFor(21097.5)).toBe('half');
    expect(predictionDistanceFor(42195.3)).toBe('marathon');
    expect(predictionDistanceFor(16093.44)).toBeUndefined();
  });
});
