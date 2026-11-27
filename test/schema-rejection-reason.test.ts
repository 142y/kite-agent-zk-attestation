import { describe, it, expect } from 'vitest';
import { KiteZKAttestationRelay } from '../src/attestation.js';

const digest = `0x${'11'.repeat(32)}`;
const proof = {
  agentId: digest,
  stateHash: digest,
  computationEpoch: 1n,
  x402ReceiptHash: digest,
  zkProof: '0x1234',
};

describe('KiteZKAttestationRelay schema rejection reason', () => {
  const relay = new KiteZKAttestationRelay(undefined, () => true);
  const reasonFor = async (raw: unknown) =>
    (await relay.verifyAttestationProof(raw)).rejectionReason;

  it('names the field that has the wrong type', async () => {
    expect(await reasonFor({ ...proof, computationEpoch: 5 })).toBe(
      'Schema validation failed: computationEpoch: Expected bigint, received number'
    );
  });

  it('names every missing field', async () => {
    const { stateHash, zkProof, ...partial } = proof;
    expect(await reasonFor(partial)).toBe(
      'Schema validation failed: stateHash: Required, zkProof: Required'
    );
  });

  it('does not repeat a field name already present in the message', async () => {
    expect(await reasonFor({ ...proof, agentId: '0x12' })).toBe(
      'Schema validation failed: agentId must be a 32-byte hex string (0x...)'
    );
  });

  it('labels a payload that is not an object as the proof itself', async () => {
    expect(await reasonFor(null)).toBe(
      'Schema validation failed: proof: Expected object, received null'
    );
  });
});
