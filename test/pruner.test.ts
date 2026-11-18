import { describe, it, expect } from "vitest";
import { AttestationPrunerDaemon, type EpochArchiveEntry } from "../src/pruner.js";

describe("AttestationPrunerDaemon", () => {
  it("enforces maxRetainedCapacity during continuous ingestion", () => {
    const daemon = new AttestationPrunerDaemon(86_400_000, 3);
    for (let i = 1n; i <= 5n; i++) {
      daemon.recordAttestation({
        agentId: "0x01",
        epoch: i,
        anchoredTimestamp: Date.now(),
        attestationDigest: "0x02",
      });
    }

    expect(daemon.getRecordCount()).toBe(3);
    const records = daemon.getRecords();
    expect(records.map((r) => r.epoch)).toEqual([3n, 4n, 5n]);
  });

  it("selectively prunes targeted agent IDs while preserving others", () => {
    const daemon = new AttestationPrunerDaemon();
    daemon.recordAttestation({
      agentId: "0xaa",
      epoch: 2n,
      anchoredTimestamp: Date.now() - 100_000_000,
      attestationDigest: "0x01",
    });
    daemon.recordAttestation({
      agentId: "0xbb",
      epoch: 2n,
      anchoredTimestamp: Date.now() - 100_000_000,
      attestationDigest: "0x02",
    });

    // Prune only 0xaa
    const report = daemon.prune({ targetAgentIds: ["0xaa"] });
    expect(report.prunedCount).toBe(1);
    expect(daemon.getRecords()).toHaveLength(1);
    expect(daemon.getRecords()[0].agentId).toBe("0xbb");
  });

  it("filters records by agent correctly", () => {
    const daemon = new AttestationPrunerDaemon();
    daemon.recordAttestation({
      agentId: "0x1111111111111111111111111111111111111111111111111111111111111111",
      epoch: 1n,
      anchoredTimestamp: Date.now(),
      attestationDigest: "0x01",
    });
    daemon.recordAttestation({
      agentId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      epoch: 2n,
      anchoredTimestamp: Date.now(),
      attestationDigest: "0x02",
    });

    const records = daemon.getRecordsByAgent("0x1111111111111111111111111111111111111111111111111111111111111111");
    expect(records).toHaveLength(1);
    expect(records[0].epoch).toBe(1n);
  });
});
