const { AttestationPrunerDaemon } = require('../dist/index.js');

const archive = new AttestationPrunerDaemon();
const agentId = '0x' + '11'.repeat(32);
const cutoff = 9007199254740994n;
for (const epoch of [cutoff - 1n, cutoff]) {
  archive.recordAttestation({
    agentId,
    epoch,
    anchoredTimestamp: Date.now(),
    attestationDigest: '0x' + epoch.toString(16).padStart(64, '0'),
  });
}

const preview = archive.previewPrune({ targetAgentIds: [agentId], retentionEpochThreshold: cutoff });
// JSON has no bigint type. Export epochs as decimal strings for lossless round trips.
const json = JSON.stringify(preview, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2);
console.log(json);
