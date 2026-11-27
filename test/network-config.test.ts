import { describe, it, expect } from 'vitest';
import { getAddress, isAddress } from 'viem';
import { KiteZKAttestationRelay } from '../src/attestation.js';
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

  describe('relay contract address validation', () => {
    const good = KITE_TESTNET_CONFIG.contractAddress;
    const make = (contractAddress: string) =>
      new KiteZKAttestationRelay({ ...KITE_TESTNET_CONFIG, contractAddress: contractAddress as `0x${string}` });

    it('accepts checksummed and single-case addresses', () => {
      expect(() => make(good)).not.toThrow();
      expect(() => make(good.toLowerCase())).not.toThrow();
    });

    it('rejects mixed-case addresses with a bad EIP-55 checksum', () => {
      const bad = good.replace('A', 'a');
      expect(() => make(bad)).toThrow(/EIP-55/);
    });

    it('rejects the zero address', () => {
      expect(() => make('0x' + '0'.repeat(40))).toThrow(/zero address/);
    });

    it('rejects a non-string network name with a clear error', () => {
      expect(() => new KiteZKAttestationRelay({ ...KITE_TESTNET_CONFIG, name: 5 as unknown as string }))
        .toThrow('Network name must not be empty');
    });
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
