import { describe, it, expect } from 'vitest';
import { makeCtx, OBJECTS } from './fixtures.js';

// Each extraction task appends a block here that snapshots its module's builders.
// Vitest writes/commits the snapshot on first run; later drift fails the test.
describe('stage config characterization', () => {
  it('fixtures load', () => {
    expect(makeCtx()).toBeTruthy();
    expect(Object.keys(OBJECTS).length).toBeGreaterThan(0);
  });
});
