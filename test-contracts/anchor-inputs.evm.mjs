import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import solc from 'solc';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain, encodeFunctionData, getContract, toFunctionSelector, zeroHash } from 'viem';

// Accepts every proof, so only the registry's own checks can reject a submission.
const permissiveVerifier = `// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import "./KiteAgentZKAttestation.sol";
contract PermissiveVerifier is IKiteVerifier {
    function verifyProof(bytes calldata, uint256[4] calldata) external pure override returns (bool) {
        return true;
    }
}`;

test('anchoring rejects zero sentinel identifiers on a private, in-process EVM', async t => {
  const sources = {
    'KiteAgentZKAttestation.sol': { content: await fs.readFile(new URL('../contracts/KiteAgentZKAttestation.sol', import.meta.url), 'utf8') },
    'PermissiveVerifier.sol': { content: permissiveVerifier },
  };
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources,
    settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  assert.deepEqual((output.errors ?? []).filter(e => e.severity === 'error'), []);
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337, hardfork: 'shanghai' }, wallet: { deterministic: true } });
  try {
    const chain = defineChain({ id: 1337, name: 'Private contract test', nativeCurrency: { name: 'Test', symbol: 'TEST', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1'] } } });
    const publicClient = createPublicClient({ chain, transport: custom(provider) });
    const wallet = createWalletClient({ chain, transport: custom(provider) });
    const [owner] = await wallet.getAddresses();
    const deploy = async (file, name, args = []) => {
      const { abi, evm } = output.contracts[file][name];
      const hash = await wallet.deployContract({ abi, bytecode: '0x' + evm.bytecode.object, args, account: owner, gas: 3_000_000n });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, 'success');
      return getContract({ address: receipt.contractAddress, abi, client: { public: publicClient, wallet } });
    };
    const verifier = await deploy('PermissiveVerifier.sol', 'PermissiveVerifier');
    const registry = await deploy('KiteAgentZKAttestation.sol', 'KiteAgentZKAttestation', [verifier.address]);
    const agentId = '0x' + '11'.repeat(32);
    const stateHash = '0x' + '22'.repeat(32);
    const receiptHash = '0x' + '33'.repeat(32);
    // Compare the raw revert data so an unrelated revert cannot satisfy the test.
    const assertAnchorReverts = (args, errorSignature) => assert.rejects(
      provider.request({ method: 'eth_call', params: [{ from: owner, to: registry.address,
        data: encodeFunctionData({ abi: registry.abi, functionName: 'anchorAttestation', args }) }, 'latest'] }),
      error => error.data === toFunctionSelector(errorSignature));

    await t.test('a zero agent ID is rejected', async () => {
      await assertAnchorReverts([zeroHash, stateHash, 1n, receiptHash, '0x'], 'EmptyAgentId()');
    });
    await t.test('a zero state hash (empty state tree root) is rejected', async () => {
      await assertAnchorReverts([agentId, zeroHash, 1n, receiptHash, '0x'], 'EmptyStateHash()');
      assert.equal(await registry.read.agentLatestEpoch([agentId]), 0n);
    });
    await t.test('non-zero identifiers still anchor', async () => {
      const hash = await registry.write.anchorAttestation(
        [agentId, stateHash, 1n, receiptHash, '0x'], { account: owner, gas: 500_000n });
      assert.equal((await publicClient.waitForTransactionReceipt({ hash })).status, 'success');
      assert.equal(await registry.read.agentLatestEpoch([agentId]), 1n);
    });
  } finally {
    await provider.disconnect();
  }
});
