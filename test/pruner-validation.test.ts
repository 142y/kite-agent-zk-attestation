import { describe, it, expect } from 'vitest';
import { AttestationPrunerDaemon } from '../src/pruner.js';
import { type Hex } from 'viem';

const agent: Hex = '0x1111111111111111111111111111111111111111111111111111111111111111';
const digest: Hex = '0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111';

describe('AttestationPrunerDaemon constructor validation', () => {
  it.each([-1, 0, 1.5, Number.NaN])('rejects invalid maxRetainedCapacity %s', (capacity) => {
    expect(() => new AttestationPrunerDaemon(3600_000, capacity)).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid defaultMaxAgeMs %s', (maxAge) => {
    expect(() => new AttestationPrunerDaemon(maxAge)).toThrow(RangeError);
  });

  it('accepts a capacity of 1 and keeps only the newest epoch', () => {
    const daemon = new AttestationPrunerDaemon(3600_000, 1);
    for (const epoch of [1n, 2n, 3n]) {
      daemon.recordAttestation({ agentId: agent, epoch, anchoredTimestamp: Date.now(), attestationDigest: digest });
    }
    expect(daemon.getRecordCount()).toBe(1);
    expect(daemon.getRecords()[0].epoch).toBe(3n);
  });

  it('keeps unbounded behaviour when capacity is omitted', () => {
    const daemon = new AttestationPrunerDaemon();
    daemon.recordAttestation({ agentId: agent, epoch: 1n, anchoredTimestamp: Date.now(), attestationDigest: digest });
    expect(daemon.getRecordCount()).toBe(1);
  });
});
