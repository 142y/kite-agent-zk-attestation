import { describe, it, expect } from 'vitest';
import { AgentExecutionProofSchema } from '../src/types.js';
import { KiteZKAttestationRelay } from '../src/attestation.js';

const base = {
  agentId: '0x' + '11'.repeat(32),
  stateHash: '0x' + '22'.repeat(32),
  computationEpoch: 1n,
  x402ReceiptHash: '0x' + '33'.repeat(32),
};

describe('AgentExecutionProofSchema zkProof', () => {
  it('accepts non-empty whole-byte hex', () => {
    expect(AgentExecutionProofSchema.safeParse({ ...base, zkProof: '0x12ab' }).success).toBe(true);
  });

  it.each(['0x', '0x123', '0xabc'])('rejects empty or odd-length proof %s', zkProof => {
    expect(AgentExecutionProofSchema.safeParse({ ...base, zkProof }).success).toBe(false);
  });

  it('relay rejects an odd-length proof before calling the verifier', async () => {
    let called = false;
    const relay = new KiteZKAttestationRelay(undefined, () => { called = true; return true; });
    const result = await relay.verifyAttestationProof({ ...base, zkProof: '0x123' });
    expect(result.valid).toBe(false);
    expect(called).toBe(false);
  });
});
