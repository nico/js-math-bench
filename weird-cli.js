#!/usr/bin/env node
// CLI runner for the "weird output" benchmark (see weird-bench.js).
// Usage: node weird-cli.js [-f substr]...   (filter by function name)

'use strict';

const { runWeirdBenchmark, computeWeirdSummary, WEIRD_FUNCTIONS } = require('./weird-bench.js');

function formatOps(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

async function main() {
  const filters = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' || args[i] === '--filter') filters.push(args[++i]);
    else if (args[i] === '-h' || args[i] === '--help') {
      console.log('Usage: node weird-cli.js [-f substr]...');
      return;
    } else { console.error('Unknown argument: ' + args[i]); process.exit(1); }
  }
  const selected = filters.length
    ? WEIRD_FUNCTIONS.filter(f => filters.some(s => f.includes(s))) : WEIRD_FUNCTIONS;
  if (selected.length === 0) { console.error('No functions match the filter.'); process.exit(1); }

  const W = 96;
  console.log('Math function performance on inputs with special results\n');
  console.log('='.repeat(W));
  console.log(
    'Inputs'.padEnd(40) + 'Result'.padStart(10) + 'ns/call'.padStart(10) +
    'Ops/sec'.padStart(12) + 'vs normal'.padStart(12) + 'OK'.padStart(6));
  console.log('-'.repeat(W));

  const results = await runWeirdBenchmark((fnName, phase, r) => {
    if (phase !== 'done') return;
    const b = r.baseline;
    console.log(
      ('Math.' + fnName + '  normal ' + b.label).padEnd(40) +
      'finite'.padStart(10) + b.nsPerCall.toFixed(2).padStart(10) +
      formatOps(b.opsPerSec).padStart(12) + '1.00x'.padStart(12) + ''.padStart(6));
    for (const c of r.cases) {
      console.log(
        ('  ' + c.label).padEnd(40) + c.expect.padStart(10) +
        c.nsPerCall.toFixed(2).padStart(10) + formatOps(c.opsPerSec).padStart(12) +
        (c.ratio.toFixed(2) + 'x').padStart(12) +
        (c.mismatches === 0 ? 'yes' : 'NO').padStart(6));
      if (c.mismatches > 0) {
        console.log('    ^ ' + c.mismatches + ' inputs did not give ' + c.expect +
          ', e.g. ' + c.example.expr + ' = ' + c.example.got);
      }
    }
  }, selected);

  console.log('='.repeat(W));
  const s = computeWeirdSummary(results);
  console.log('\nSpecial-result speed vs normal (geometric mean): ' + s.meanRatio.toFixed(2) + 'x');
  if (s.slowest) {
    console.log('Slowest: Math.' + s.slowest.fn + ' ' + s.slowest.label + ' at ' +
      s.slowest.ratio.toFixed(2) + 'x');
  }
  console.log(s.mismatchedCases === 0
    ? 'All ' + s.cases + ' cases returned the expected result class.'
    : s.mismatchedCases + ' of ' + s.cases + ' cases returned an unexpected result.');
}

main().catch(e => { console.error(e); process.exit(1); });
