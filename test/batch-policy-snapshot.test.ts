import { describe, expect, it } from "vitest";
import { BatchAttestationPipeline, type BatchAnchorRequest } from "../src/pipeline.js";
import { KiteZKAttestationRelay } from "../src/attestation.js";
import { KITE_TESTNET_CONFIG, type AgentExecutionProof } from "../src/types.js";

const proof: AgentExecutionProof = {
  agentId: `0x${"11".repeat(32)}`,
  stateHash: `0x${"22".repeat(32)}`,
  computationEpoch: 1n,
  x402ReceiptHash: `0x${"33".repeat(32)}`,
  zkProof: "0x1234",
};

describe("per-invocation batch policy", () => {
  it.each([true, false])("keeps stopOnFirstRejection=%s across an asynchronous verifier", async (stop) => {
    let release!: (value: boolean) => void;
    const pending = new Promise<boolean>(resolve => { release = resolve; });
    let calls = 0;
    const relay = new KiteZKAttestationRelay(KITE_TESTNET_CONFIG, () => ++calls === 1 ? pending : true);
    const request: BatchAnchorRequest = { proofs: [proof, { ...proof, computationEpoch: 2n }], stopOnFirstRejection: stop };
    const result = new BatchAttestationPipeline(relay).processBatch(request);
    request.stopOnFirstRejection = !stop;
    release(false);
    const summary = await result;
    expect(summary.totalProcessed).toBe(stop ? 1 : 2);
    expect(summary.acceptedCount).toBe(stop ? 0 : 1);
  });

  it.each([true, false])("keeps strictEpochOrdering=%s while awaiting a permissive relay", async (strict) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    // 本地替身有意不检查 epoch，只验证批处理自身的策略；不代表真实 SNARK 或链上锚定。
    const relay = {
      async verifyAttestationProof(value: AgentExecutionProof) {
        if (++calls === 1) await pending;
        return { valid: true, attestationDigest: value.stateHash, agentId: value.agentId, epoch: value.computationEpoch };
      },
    } as unknown as KiteZKAttestationRelay;
    const request: BatchAnchorRequest = { proofs: [proof, { ...proof }], strictEpochOrdering: strict };
    const result = new BatchAttestationPipeline(relay).processBatch(request);
    request.strictEpochOrdering = !strict;
    release();
    const summary = await result;
    expect(summary.acceptedCount).toBe(strict ? 1 : 2);
    expect(summary.rejectedCount).toBe(strict ? 1 : 0);
  });
});
