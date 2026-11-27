import { describe, it, expect } from 'vitest';
import { type Hex } from 'viem';
import { KiteZKAttestationRelay } from '../src/attestation.js';
import { type AgentExecutionProof } from '../src/types.js';
const other = ('0x' + '44'.repeat(32)) as Hex;
function proof(epoch = 1n): AgentExecutionProof {
  return { agentId: ('0x' + '11'.repeat(32)) as Hex, stateHash: ('0x' + '22'.repeat(32)) as Hex,
    x402ReceiptHash: ('0x' + '33'.repeat(32)) as Hex, computationEpoch: epoch, zkProof: '0x1234' };
}

describe('verifier input integrity', () => {
  for (const field of ['computationEpoch', 'agentId', 'publicInputs'] as const) {
    it(`rejects a verifier that mutates ${field} without advancing accepted state`, async () => {
      let mutate = true;
      // 本地验证器替身只用于边界测试，不提供真实 SNARK 验证或链上锚定证据。
      const relay = new KiteZKAttestationRelay(undefined, (candidate, inputs) => {
        if (mutate) {
          if (field === 'computationEpoch') candidate.computationEpoch = 2n;
          else if (field === 'agentId') candidate.agentId = other;
          else (inputs as unknown as Hex[])[0] = other;
        }
        return true;
      });
      const raw = proof();
      const rejected = await relay.verifyAttestationProof(raw);
      expect(rejected.valid).toBe(false);
      expect(raw).toEqual(proof());
      mutate = false;
      const accepted = await relay.verifyAttestationProof(raw);
      expect(accepted.valid).toBe(true);
      expect(accepted.epoch).toBe(1n);
      expect(accepted.agentId).toBe(raw.agentId);
      expect(accepted.attestationDigest).toBe(relay.computeAttestationDigest(raw));
    });
  }

  it('preserves asynchronous verification and concurrent epoch monotonicity', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const relay = new KiteZKAttestationRelay(undefined, async (candidate, inputs) => {
      expect(inputs).toEqual(relay.generateVerifierPublicInputs(candidate));
      if (candidate.computationEpoch === 1n) await pending;
      return true;
    });
    const first = relay.verifyAttestationProof(proof(1n));
    const later = await relay.verifyAttestationProof(proof(2n));
    release();
    expect(later.valid).toBe(true);
    expect((await first).valid).toBe(false);
    expect(later.attestationDigest).toBe(relay.computeAttestationDigest(proof(2n)));
  });
});
