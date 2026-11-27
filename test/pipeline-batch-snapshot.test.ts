import { describe, it, expect } from "vitest";
import { KiteZKAttestationRelay } from "../src/attestation.js";
import { BatchAttestationPipeline } from "../src/pipeline.js";
import { AgentExecutionProof, KITE_TESTNET_CONFIG } from "../src/types.js";

const proofAt = (computationEpoch: bigint): AgentExecutionProof => ({
  agentId: `0x${"aa".repeat(32)}`,
  stateHash: `0x${"11".repeat(32)}`,
  computationEpoch,
  x402ReceiptHash: `0x${"22".repeat(32)}`,
  zkProof: "0x1234567890abcdef",
});

describe("BatchAttestationPipeline batch membership", () => {
  const mutations: Array<[string, (queue: AgentExecutionProof[]) => void]> = [
    ["drained", (queue) => { queue.length = 0; }],
    ["appended to", (queue) => { queue.push(proofAt(4n)); }],
    ["shifted", (queue) => { queue.shift(); }],
  ];

  it.each(mutations)(
    "processes exactly the submitted proofs when the caller's array is %s mid-batch",
    async (_label, mutate) => {
      const verifiedEpochs: bigint[] = [];
      const relay = new KiteZKAttestationRelay(KITE_TESTNET_CONFIG, (proof) => {
        verifiedEpochs.push(proof.computationEpoch);
        return true;
      });
      const queue = [proofAt(1n), proofAt(2n), proofAt(3n)];

      const pending = new BatchAttestationPipeline(relay).processBatch({ proofs: queue });
      mutate(queue);
      const summary = await pending;

      expect(verifiedEpochs).toEqual([1n, 2n, 3n]);
      expect(summary.totalProcessed).toBe(3);
      expect(summary.acceptedCount).toBe(3);
      expect(summary.rejectedCount).toBe(0);
    }
  );
});
