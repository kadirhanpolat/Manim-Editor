import { describe, expect, it } from 'vitest';
import {
  renderPhaseLabel,
  renderQueuePosition,
  renderWorkerSummary,
} from '../../src/components/render/render-ui.js';

describe('render ui helpers', () => {
  it('maps render states to human-readable phases', () => {
    expect(renderPhaseLabel(null)).toBe('Idle');
    expect(renderPhaseLabel('queued')).toBe('Queued');
    expect(renderPhaseLabel('running')).toBe('Rendering');
    expect(renderPhaseLabel('canceling')).toBe('Canceling');
    expect(renderPhaseLabel('canceled')).toBe('Canceled');
    expect(renderPhaseLabel('failed')).toBe('Failed');
  });

  it('derives queue position only while queued', () => {
    expect(renderQueuePosition(null, 3)).toBe(null);
    expect(renderQueuePosition('running', 3)).toBe(null);
    expect(renderQueuePosition('queued', 3)).toBe('#4');
  });

  it('summarizes worker health without leaking formatting noise', () => {
    expect(renderWorkerSummary(true, 2, 1, 0)).toBe('Checking workers...');
    expect(renderWorkerSummary(false, 2, 1, 0)).toBe('2 online · 1 busy · 0 stale');
    expect(renderWorkerSummary(false, null, null, null)).toBe('Unavailable');
  });
});
