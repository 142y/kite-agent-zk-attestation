import { describe, it, expect } from 'vitest';
import { encodeAbiParameters, size, zeroHash } from 'viem';
import { KiteZKAttestationRelay } from '../src/attestation.js';

describe('KiteZKAttestationRelay schema rejection result', () => {
  const relay = new KiteZKAttestationRelay(undefined, () => true);

  it.each([
    ['null payload', null],
    ['missing fields', { agentId: '0x1234' }],
    ['non-bigint epoch', { agentId: zeroHash, stateHash: zeroHash, computationEpoch: 1, x402ReceiptHash: zeroHash, zkProof: '0x00' }],
  ])('returns bytes32 zero sentinels for %s', async (_label, raw) => {
    const result = await relay.verifyAttestationProof(raw);
    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toMatch(/^Schema validation failed/);
    expect(result.attestationDigest).toBe(zeroHash);
    expect(result.agentId).toBe(zeroHash);
    expect(size(result.attestationDigest)).toBe(32);
  });

  it('produces results that can be ABI-encoded as bytes32 without throwing', async () => {
    const result = await relay.verifyAttestationProof({});
    expect(() =>
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
        [result.agentId, result.attestationDigest, result.epoch]
      )
    ).not.toThrow();
  });
});
