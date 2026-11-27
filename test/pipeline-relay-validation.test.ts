import { describe, it, expect } from 'vitest';
import { BatchAttestationPipeline } from '../src/pipeline.js';
import { KiteZKAttestationRelay } from '../src/attestation.js';

describe('BatchAttestationPipeline construction', () => {
  it('rejects a missing or malformed relay up front', () => {
    for (const bad of [undefined, null, {}, 'relay', { verifyAttestationProof: 1 }]) {
      expect(() => new BatchAttestationPipeline(bad as never)).toThrow(TypeError);
    }
  });

  it('accepts a real relay', () => {
    expect(() => new BatchAttestationPipeline(new KiteZKAttestationRelay())).not.toThrow();
  });
});
