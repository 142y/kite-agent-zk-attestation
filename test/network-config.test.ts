import { describe, it, expect } from 'vitest';
import { getAddress, isAddress } from 'viem';
import { KITE_MAINNET_CONFIG, KITE_TESTNET_CONFIG } from '../src/types.js';
import { KiteZKAttestationRelay } from '../src/attestation.js';

describe('Kite network configs', () => {
  it.each([KITE_TESTNET_CONFIG, KITE_MAINNET_CONFIG])('$name contract address is EIP-55 checksummed', (config) => {
    // viem rejects mixed-case addresses with an invalid checksum in strict mode,
    // so the shipped defaults must be canonical checksummed addresses.
    expect(isAddress(config.contractAddress)).toBe(true);
    expect(config.contractAddress).toBe(getAddress(config.contractAddress));
  });

  it('uses distinct chain ids for testnet and mainnet', () => {
    expect(KITE_TESTNET_CONFIG.chainId).not.toBe(KITE_MAINNET_CONFIG.chainId);
  });
});

describe('Kite network config immutability', () => {
  it.each([KITE_TESTNET_CONFIG, KITE_MAINNET_CONFIG])('$name default config cannot be mutated', (config) => {
    expect(Object.isFrozen(config)).toBe(true);
    const original = config.rpcUrl;
    expect(() => {
      (config as { rpcUrl: string }).rpcUrl = 'https://evil.example';
    }).toThrow(TypeError);
    expect(config.rpcUrl).toBe(original);
  });

  it('relays built from defaults still expose a mutable copy', () => {
    const copy = new KiteZKAttestationRelay().getNetworkConfig();
    copy.rpcUrl = 'https://other.example';
    expect(new KiteZKAttestationRelay().getNetworkConfig().rpcUrl).toBe(KITE_TESTNET_CONFIG.rpcUrl);
  });
});
