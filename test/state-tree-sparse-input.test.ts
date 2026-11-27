import { describe, it, expect } from 'vitest';
import { type Hex, zeroHash } from 'viem';
import { AgentStateTree, verifyInclusionPath } from '../src/state-tree.js';

const a = ('0x' + '11'.repeat(32)) as Hex;
const b = ('0x' + '22'.repeat(32)) as Hex;
const invalidLeaf = 'Action leaves must be 32-byte hex digests';

describe('initial action leaf ingestion', () => {
  it('rejects an entirely sparse input at construction', () => {
    expect(() => new AgentStateTree(new Array<Hex>(2))).toThrow(invalidLeaf);
  });

  it('rejects a missing first position before accepting later valid leaves', () => {
    const leaves = new Array<Hex>(2);
    leaves[1] = a;
    expect(() => new AgentStateTree(leaves)).toThrow(invalidLeaf);
  });

  it('rejects holes introduced by deleting a middle action', () => {
    const leaves: Hex[] = [a, b, a];
    delete leaves[1];
    expect(() => new AgentStateTree(leaves)).toThrow(invalidLeaf);
  });

  it('preserves dense roots, paths and caller-array isolation', () => {
    const input = [a, b];
    const tree = new AgentStateTree(input);
    const rebuilt = new AgentStateTree();
    rebuilt.insertActionLeaf(a);
    rebuilt.insertActionLeaf(b);
    const root = tree.getRoot();

    expect(root).toBe(rebuilt.getRoot());
    expect(verifyInclusionPath(a, tree.getInclusionPath(0), root)).toBe(true);
    // 构造后修改调用方数组，不能改变已接收的动作顺序和根。
    input[0] = b;
    expect(tree.getRoot()).toBe(root);
  });

  it('keeps empty trees and later append behavior unchanged', () => {
    const tree = new AgentStateTree();
    expect(tree.getRoot()).toBe(zeroHash);
    tree.insertActionLeaf(a);
    expect(tree.getLeafCount()).toBe(1);
    expect(verifyInclusionPath(a, tree.getInclusionPath(0), tree.getRoot())).toBe(true);
  });
});
