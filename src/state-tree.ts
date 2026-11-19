import { type Hex, concatHex, keccak256 } from 'viem';

export interface MerkleStep {
  hash: Hex;
  position: 'left' | 'right';
}

/**
 * Utility for aggregating agent execution actions into a Merkle digest
 */
export class AgentStateTree {
  private leaves: Hex[] = [];

  constructor(initialLeaves: Hex[] = []) {
    initialLeaves.forEach((leaf) => this.validateLeaf(leaf));
    this.leaves = [...initialLeaves];
  }

  public insertActionLeaf(actionHash: Hex): void {
    this.validateLeaf(actionHash);
    this.leaves.push(actionHash);
  }

  public getLeafCount(): number {
    return this.leaves.length;
  }

  public getRoot(): Hex {
    if (this.leaves.length === 0) {
      return ('0x' + '0'.repeat(64)) as Hex;
    }
    return this.reduceTree();
  }

  /** Sibling hashes ordered from the leaf toward the root. */
  public getInclusionPath(index: number): MerkleStep[] {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.leaves.length) {
      throw new RangeError('Leaf index outside the state tree');
    }
    const steps: MerkleStep[] = [];
    this.reduceTree({ index, steps });
    return steps;
  }

  private reduceTree(path?: { index: number; steps: MerkleStep[] }): Hex {
    let currentLevel = this.leaves.map((leaf) => keccak256(concatHex(['0x00', leaf])));

    while (currentLevel.length > 1) {
      if (path) {
        const isRight = path.index % 2 === 1;
        const sibling = isRight ? path.index - 1 : path.index + 1;
        if (sibling < currentLevel.length) {
          path.steps.push({ hash: currentLevel[sibling], position: isRight ? 'left' : 'right' });
        }
        path.index = Math.floor(path.index / 2);
      }
      const nextLevel: Hex[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(this.hashPair(currentLevel[i], currentLevel[i + 1]));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  private hashPair(a: Hex, b: Hex): Hex {
    return keccak256(concatHex(['0x01', a, b]));
  }

  private validateLeaf(leaf: Hex): void {
    if (!/^0x[0-9a-fA-F]{64}$/.test(leaf)) {
      throw new Error('Action leaves must be 32-byte hex digests');
    }
  }
}
