import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { isAddress } from 'viem';
import { KITE_TESTNET_CONFIG } from '../src/types.js';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
// Standalone 20-byte values only, so longer digests are not mistaken for addresses.
const addresses = readme.match(/\b0x[0-9a-fA-F]{40}\b/g) ?? [];

describe('README contract addresses', () => {
  it('only publishes addresses that pass strict EIP-55 validation', () => {
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) {
      expect(isAddress(address, { strict: true }), address).toBe(true);
    }
  });

  it('documents the same testnet contract as the shipped network config', () => {
    expect(addresses).toContain(KITE_TESTNET_CONFIG.contractAddress);
  });
});
