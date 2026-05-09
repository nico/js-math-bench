#!/usr/bin/env node
// Generates a single standalone JS file that runs in any JS engine (d8, jsc, etc).
// Usage: node bundle.js > bench-standalone.js

'use strict';

const fs = require('fs');
const path = require('path');

const bench = fs.readFileSync(path.join(__dirname, 'bench.js'), 'utf8');
const testData = fs.readFileSync(path.join(__dirname, 'test_data.json'), 'utf8');

// Strip the module.exports block from bench.js
const benchClean = bench.replace(
  /\/\/ Export for both.*\nif \(typeof module.*\n.*\n\}/s, '');

const runner = `
// --- Standalone runner ---

var _testData = ${testData};

var _log = typeof console !== 'undefined' ? function(s) { console.log(s); } : print;

function _formatOps(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

(async function() {
  _log('Running benchmark...\\n');

  var results = await runBenchmark(_testData, function(fnName, phase) {
    if (phase === 'done') _log('  ' + fnName + ': done');
  });

  var W = 110;
  _log('\\n' + '='.repeat(W));
  _log(
    'Function'.padEnd(14) +
    'Max ULP'.padStart(10) +
    'Mean ULP'.padStart(12) +
    '% CR'.padStart(8) +
    '% FR'.padStart(8) +
    'Accuracy'.padStart(10) +
    'Ops/sec'.padStart(14) +
    'Perf+'.padStart(8) +
    'Total'.padStart(8)
  );
  _log('-'.repeat(W));

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var a = r.accuracy;
    var p = r.perf;
    var accuracyScore = 100 / (1 + a.meanUlp);
    var total = accuracyScore + p.perfBonus;
    var maxUlp = a.maxUlp === Infinity ? 'Inf' : a.maxUlp.toFixed(2);

    _log(
      ('Math.' + r.fn).padEnd(14) +
      maxUlp.padStart(10) +
      a.meanUlp.toFixed(4).padStart(12) +
      (a.correctlyRoundedPct.toFixed(1) + '%').padStart(8) +
      (a.faithfullyRoundedPct.toFixed(1) + '%').padStart(8) +
      accuracyScore.toFixed(1).padStart(10) +
      _formatOps(p.avgOpsPerSec).padStart(14) +
      p.perfBonus.toFixed(1).padStart(8) +
      total.toFixed(1).padStart(8)
    );
    if (a.maxUlp > 0) {
      var input = Array.isArray(a.worstInput) ? a.worstInput.join(', ') : a.worstInput;
      _log(
        ''.padEnd(14) +
        '  ^ input: ' + input + '  expected: ' + a.worstExpected + '  got: ' + a.worstComputed
      );
    }
  }

  _log('='.repeat(W));
  _log('\\nOverall Score: ' + computeOverallScore(results).toFixed(1));
})();
`;

process.stdout.write(benchClean + runner);
