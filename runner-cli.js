#!/usr/bin/env node
// CLI runner for js-math-bench
// Usage: node runner-cli.js

'use strict';

const fs = require('fs');
const path = require('path');
const { FUNCTIONS, runBenchmark, computeOverallScore } = require('./bench.js');

async function main() {
  const dataPath = path.join(__dirname, 'test_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('test_data.json not found. Run generate_test_data.py first.');
    process.exit(1);
  }

  console.log('Loading test data...');
  const testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log('Running benchmark...\n');

  const results = await runBenchmark(testData, (fnName, phase) => {
    if (phase === 'accuracy') {
      process.stdout.write(`  ${fnName}: accuracy...`);
    } else if (phase === 'perf') {
      process.stdout.write(' perf...');
    } else if (phase === 'done') {
      process.stdout.write(' done\n');
    }
  });

  // Print results table
  console.log('\n' + '='.repeat(100));
  console.log(
    'Function'.padEnd(14) +
    'Max ULP'.padStart(10) +
    'Mean ULP'.padStart(12) +
    '% CR'.padStart(8) +
    '% FR'.padStart(8) +
    'Ops/sec'.padStart(14) +
    'Perf+'.padStart(8) +
    'Total'.padStart(8)
  );
  console.log('-'.repeat(100));

  for (const r of results) {
    const a = r.accuracy;
    const p = r.perf;
    const total = a.correctlyRoundedPct + p.perfBonus;
    const maxUlp = a.maxUlp === Infinity ? 'Inf' : a.maxUlp.toFixed(2);
    const opsStr = p.avgOpsPerSec >= 1e9 ? (p.avgOpsPerSec / 1e9).toFixed(1) + 'B'
                 : p.avgOpsPerSec >= 1e6 ? (p.avgOpsPerSec / 1e6).toFixed(1) + 'M'
                 : p.avgOpsPerSec >= 1e3 ? (p.avgOpsPerSec / 1e3).toFixed(1) + 'K'
                 : p.avgOpsPerSec.toFixed(0);

    console.log(
      `Math.${r.fn}`.padEnd(14) +
      maxUlp.padStart(10) +
      a.meanUlp.toFixed(4).padStart(12) +
      (a.correctlyRoundedPct.toFixed(1) + '%').padStart(8) +
      (a.faithfullyRoundedPct.toFixed(1) + '%').padStart(8) +
      opsStr.padStart(14) +
      p.perfBonus.toFixed(1).padStart(8) +
      total.toFixed(1).padStart(8)
    );
    if (a.maxUlp > 0) {
      const input = Array.isArray(a.worstInput) ? a.worstInput.join(', ') : a.worstInput;
      console.log(
        ''.padEnd(14) +
        `  ^ input: ${input}  expected: ${a.worstExpected}  got: ${a.worstComputed}`
      );
    }
  }

  console.log('='.repeat(100));
  const overallScore = computeOverallScore(results);
  console.log(`\nOverall Score: ${overallScore.toFixed(1)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
