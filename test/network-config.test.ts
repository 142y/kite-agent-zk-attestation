import { describe, it, expect } from 'vitest';
import { getAddress, isAddress } from 'viem';
import { KiteZKAttestationRelay } from '../src/attestation.js';
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

describe('KiteZKAttestationRelay config shape validation', () => {
  it.each([null, 42, 'config', []])('rejects non-object config %j with a TypeError', (bad) => {
    expect(() => new KiteZKAttestationRelay(bad as never)).toThrow(/Network config must be an object/);
  });

  it.each([undefined, 123, null, {}])('rejects non-string or empty network name %j', (name) => {
    expect(() => new KiteZKAttestationRelay({ ...KITE_TESTNET_CONFIG, name } as never))
      .toThrow(/Network name must not be empty/);
  });

  it('still accepts the shipped configs', () => {
    expect(() => new KiteZKAttestationRelay(KITE_TESTNET_CONFIG)).not.toThrow();
    expect(() => new KiteZKAttestationRelay(KITE_MAINNET_CONFIG)).not.toThrow();
  });
});
