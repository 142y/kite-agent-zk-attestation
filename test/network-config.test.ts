import { describe, it, expect } from 'vitest';
import { getAddress, isAddress } from 'viem';
import { KITE_MAINNET_CONFIG, KITE_TESTNET_CONFIG } from '../src/types.js';

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
