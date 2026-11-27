import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { AgentStateTree } from '../dist/state-tree.js';

const operations = 32;
const rounds = 5;
const digest = index => '0x' + index.toString(16).padStart(64, '0');

function measure(operation) {
  const start = performance.now();
  const results = Array.from({ length: operations }, (_, index) => operation(index));
  return { ms: performance.now() - start, results };
}

function median(samples) {
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)].toFixed(2);
}

for (const size of [128, 512]) {
  const leaves = Array.from({ length: size + operations }, (_, i) => digest(i));
  const initial = leaves.slice(0, size);
  const samples = { cachedPaths: [], rebuiltPaths: [], appendAndRoot: [], rebuiltRoots: [] };
  for (let round = 0; round <= rounds; round++) {
    const tree = new AgentStateTree(initial);
    tree.getRoot();
    const index = i => Math.floor(i * size / operations);
    const cachedPaths = measure(i => tree.getInclusionPath(index(i)));
    const rebuiltPaths = measure(i => new AgentStateTree(initial).getInclusionPath(index(i)));
    const appendAndRoot = measure(i => {
      tree.insertActionLeaf(leaves[size + i]);
      return tree.getRoot();
    });
    const rebuiltRoots = measure(i => new AgentStateTree(leaves.slice(0, size + i + 1)).getRoot());
    assert.deepEqual(cachedPaths.results, rebuiltPaths.results);
    assert.deepEqual(appendAndRoot.results, rebuiltRoots.results);
    if (round > 0) {
      for (const [name, run] of Object.entries({ cachedPaths, rebuiltPaths, appendAndRoot, rebuiltRoots })) {
        samples[name].push(run.ms);
      }
    }
  }
  console.log(`Initial leaves: ${size}, operations per workload: ${operations}, median of ${rounds} rounds (ms)`);
  console.table(Object.fromEntries(Object.entries(samples).map(([name, times]) => [name, median(times)])));
}
