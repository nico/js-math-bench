// js-math-bench: Core benchmark logic
// Measures accuracy (ULP error) and performance (ops/sec) of Math functions.

'use strict';

const FUNCTIONS = [
  'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
  'cbrt', 'cos', 'cosh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10',
  'pow', 'sin', 'sinh', 'sqrt', 'tan', 'tanh'
];

const BINARY_FUNCTIONS = new Set(['atan2', 'pow']);

// --- Hex float parsing ---

function parseHexFloat(s) {
  if (s === 'NaN') return NaN;
  if (s === '+Infinity' || s === 'Infinity') return Infinity;
  if (s === '-Infinity') return -Infinity;
  if (s === '0') return 0;
  if (s === '-0') return -0;
  // Parse hex float like "0x1.921fb54442d18p+1" or "-0x1.abcp-3"
  return parseHexFloatManual(s);
}

function parseHexFloatManual(s) {
  // JavaScript doesn't have a built-in hex float parser for Number.
  // We need to parse "0x1.921fb54442d18p+1" manually.
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (s.startsWith('+')) s = s.slice(1);

  // Split on 'p' or 'P'
  const pIdx = s.indexOf('p');
  const P = pIdx === -1 ? s.indexOf('P') : pIdx;

  let exp2 = 0;
  let mantissaStr = s;
  if (P !== -1) {
    exp2 = parseInt(s.slice(P + 1), 10);
    mantissaStr = s.slice(0, P);
  }

  // Remove '0x' prefix
  if (mantissaStr.startsWith('0x') || mantissaStr.startsWith('0X')) {
    mantissaStr = mantissaStr.slice(2);
  }

  // Split on '.'
  const dotIdx = mantissaStr.indexOf('.');
  let intPart, fracPart;
  if (dotIdx === -1) {
    intPart = mantissaStr;
    fracPart = '';
  } else {
    intPart = mantissaStr.slice(0, dotIdx);
    fracPart = mantissaStr.slice(dotIdx + 1);
  }

  // Parse integer and fractional hex digits
  let value = 0;
  if (intPart) {
    value = parseInt(intPart, 16);
  }
  if (fracPart) {
    value += parseInt(fracPart, 16) / Math.pow(16, fracPart.length);
  }

  value *= Math.pow(2, exp2);
  return neg ? -value : value;
}

// --- ULP computation ---

// Get the ULP (Unit in Last Place) of a finite, non-zero double.
function ulpOf(x) {
  if (!isFinite(x) || x === 0) return 0;
  const buf = new Float64Array(1);
  const view = new DataView(buf.buffer);
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  // Clear sign bit
  const absBits = bits & 0x7FFFFFFFFFFFFFFFn;
  // Get exponent
  const expBits = Number((absBits >> 52n) & 0x7FFn);
  if (expBits === 0) {
    // Denormal: ULP is the smallest denormal
    return 5e-324;
  }
  // Normal: ULP = 2^(exponent - 52 - 1023) = 2^(expBits - 1075)
  return Math.pow(2, expBits - 1075);
}

// Compute ULP error between computed and expected values.
function ulpError(computed, expected) {
  // Both NaN: considered exact match
  if (isNaN(expected) && isNaN(computed)) return 0;
  // One NaN, other not: infinite error
  if (isNaN(expected) || isNaN(computed)) return Infinity;
  // Both infinite with same sign: exact match
  if (expected === computed) return 0;
  // Expected is infinite but computed is not (or vice versa): infinite error
  if (!isFinite(expected) || !isFinite(computed)) {
    if (!isFinite(expected) && !isFinite(computed)) return Infinity; // different sign infinities
    return Infinity;
  }
  // Expected is zero
  if (expected === 0) {
    if (computed === 0) {
      // Check sign: -0 vs +0 -- we consider this 0 ULP error since
      // JS Math functions don't always distinguish signed zero
      return 0;
    }
    // expected is 0 but computed is not -- use ULP of smallest denormal
    return Math.abs(computed) / 5e-324;
  }
  return Math.abs(computed - expected) / ulpOf(expected);
}

// --- Seeded PRNG (xoshiro128**) for reproducible perf tests ---

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// --- Performance test input generation ---

function generatePerfInputs(fnName, rng) {
  const sets = {};
  const N = 100000;

  if (BINARY_FUNCTIONS.has(fnName)) {
    // For binary functions, generate pairs
    sets['[0,1]x[0,1]'] = { a: new Float64Array(N), b: new Float64Array(N) };
    sets['[-10,10]x[-10,10]'] = { a: new Float64Array(N), b: new Float64Array(N) };
    sets['ints [0,1000)'] = { a: new Float64Array(N), b: new Float64Array(N) };

    for (let i = 0; i < N; i++) {
      sets['[0,1]x[0,1]'].a[i] = rng();
      sets['[0,1]x[0,1]'].b[i] = rng();
      sets['[-10,10]x[-10,10]'].a[i] = rng() * 20 - 10;
      sets['[-10,10]x[-10,10]'].b[i] = rng() * 20 - 10;
      sets['ints [0,1000)'].a[i] = (rng() * 1000) | 0;
      sets['ints [0,1000)'].b[i] = (rng() * 1000) | 0;
    }
  } else {
    sets['[0,1]'] = new Float64Array(N);
    sets['[-10,10]'] = new Float64Array(N);
    sets['ints [0,100000)'] = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      sets['[0,1]'][i] = rng();
      sets['[-10,10]'][i] = rng() * 20 - 10;
      sets['ints [0,100000)'][i] = i;
    }
  }

  return sets;
}

// --- Core benchmark ---

function runAccuracyTest(fnName, testData) {
  const isBinary = BINARY_FUNCTIONS.has(fnName);
  const fn = isBinary
    ? (a, b) => Math[fnName](a, b)
    : (x) => Math[fnName](x);

  const categories = ['worstCase', 'systematic', 'edgeCases'];
  let totalUlp = 0;
  let maxUlp = 0;
  let count = 0;
  let correctlyRounded = 0;  // <= 0.5 ULP
  let faithfullyRounded = 0; // <= 1.0 ULP
  let worstInput = null;
  let worstExpected = null;
  let worstComputed = null;

  for (const cat of categories) {
    const cases = testData[cat] || [];
    for (const tc of cases) {
      let computed;
      if (isBinary) {
        const a = parseHexFloat(tc.in[0]);
        const b = parseHexFloat(tc.in[1]);
        computed = fn(a, b);
      } else {
        const x = parseHexFloat(tc.in);
        computed = fn(x);
      }
      const expected = parseHexFloat(tc.out);
      const ulp = ulpError(computed, expected);

      totalUlp += Math.min(ulp, 1e15); // cap for mean calculation
      if (ulp <= 0.5) correctlyRounded++;
      if (ulp <= 1.0) faithfullyRounded++;
      if (ulp > maxUlp || (ulp === Infinity && maxUlp !== Infinity)) {
        maxUlp = ulp;
        worstInput = tc.in;
        worstExpected = expected;
        worstComputed = computed;
      }
      count++;
    }
  }

  return {
    fn: fnName,
    count,
    maxUlp,
    meanUlp: count > 0 ? totalUlp / count : 0,
    correctlyRoundedPct: count > 0 ? (correctlyRounded / count) * 100 : 0,
    faithfullyRoundedPct: count > 0 ? (faithfullyRounded / count) * 100 : 0,
    worstInput,
    worstExpected,
    worstComputed,
  };
}

// Run the inner perf loop with a direct Math.xxx() call via a switch.
// This gives each function its own monomorphic call site, letting the JIT
// inline the Math builtin. A closure factory doesn't work because V8 shares
// inline cache feedback across closures from the same factory function.
function runUnaryLoop(fnName, arr, n) {
  var d = 0;
  switch (fnName) {
    case 'acos':  for (var i = 0; i < n; i++) d += Math.acos(arr[i]); break;
    case 'acosh': for (var i = 0; i < n; i++) d += Math.acosh(arr[i]); break;
    case 'asin':  for (var i = 0; i < n; i++) d += Math.asin(arr[i]); break;
    case 'asinh': for (var i = 0; i < n; i++) d += Math.asinh(arr[i]); break;
    case 'atan':  for (var i = 0; i < n; i++) d += Math.atan(arr[i]); break;
    case 'atanh': for (var i = 0; i < n; i++) d += Math.atanh(arr[i]); break;
    case 'cbrt':  for (var i = 0; i < n; i++) d += Math.cbrt(arr[i]); break;
    case 'cos':   for (var i = 0; i < n; i++) d += Math.cos(arr[i]); break;
    case 'cosh':  for (var i = 0; i < n; i++) d += Math.cosh(arr[i]); break;
    case 'exp':   for (var i = 0; i < n; i++) d += Math.exp(arr[i]); break;
    case 'expm1': for (var i = 0; i < n; i++) d += Math.expm1(arr[i]); break;
    case 'log':   for (var i = 0; i < n; i++) d += Math.log(arr[i]); break;
    case 'log1p': for (var i = 0; i < n; i++) d += Math.log1p(arr[i]); break;
    case 'log2':  for (var i = 0; i < n; i++) d += Math.log2(arr[i]); break;
    case 'log10': for (var i = 0; i < n; i++) d += Math.log10(arr[i]); break;
    case 'sin':   for (var i = 0; i < n; i++) d += Math.sin(arr[i]); break;
    case 'sinh':  for (var i = 0; i < n; i++) d += Math.sinh(arr[i]); break;
    case 'sqrt':  for (var i = 0; i < n; i++) d += Math.sqrt(arr[i]); break;
    case 'tan':   for (var i = 0; i < n; i++) d += Math.tan(arr[i]); break;
    case 'tanh':  for (var i = 0; i < n; i++) d += Math.tanh(arr[i]); break;
  }
  return d;
}

function runBinaryLoop(fnName, a, b, n) {
  var d = 0;
  switch (fnName) {
    case 'atan2': for (var i = 0; i < n; i++) d += Math.atan2(a[i], b[i]); break;
    case 'pow':   for (var i = 0; i < n; i++) d += Math.pow(a[i], b[i]); break;
  }
  return d;
}

function runPerfTest(fnName) {
  const rng = mulberry32(0x12345678);
  const inputSets = generatePerfInputs(fnName, rng);
  const isBinary = BINARY_FUNCTIONS.has(fnName);
  const results = {};

  const now = typeof performance !== 'undefined'
    ? () => performance.now() : () => Date.now();

  for (const [setName, inputs] of Object.entries(inputSets)) {
    const N = isBinary ? inputs.a.length : inputs.length;

    // Warm up so the JIT compiles the runner
    for (let w = 0; w < 5; w++) {
      if (isBinary) runBinaryLoop(fnName, inputs.a, inputs.b, N);
      else runUnaryLoop(fnName, inputs, N);
    }

    // Run for at least MIN_TIME_MS, looping over the input array.
    // Collect per-pass timings for 3 separate measurement rounds, take median.
    const MIN_TIME_MS = 10;
    const ROUNDS = 3;
    const opsPerSecSamples = [];

    for (let r = 0; r < ROUNDS; r++) {
      let totalOps = 0;
      let dummy = 0;
      const deadline = now() + MIN_TIME_MS;
      const start = now();
      if (isBinary) {
        while (now() < deadline) {
          dummy += runBinaryLoop(fnName, inputs.a, inputs.b, N);
          totalOps += N;
        }
      } else {
        while (now() < deadline) {
          dummy += runUnaryLoop(fnName, inputs, N);
          totalOps += N;
        }
      }
      const elapsed = now() - start;
      // Use dummy to prevent dead-code elimination
      if (dummy !== dummy + 1) void 0;
      opsPerSecSamples.push((totalOps / elapsed) * 1000);
    }

    opsPerSecSamples.sort((a, b) => a - b);
    const opsPerSec = opsPerSecSamples[Math.floor(ROUNDS / 2)];
    results[setName] = { opsPerSec, n: N };
  }

  // Overall ops/sec: average across sets
  const allOps = Object.values(results).map(r => r.opsPerSec);
  const avgOpsPerSec = allOps.reduce((a, b) => a + b, 0) / allOps.length;

  // Performance bonus: 0-20, based on reference rate of 1000M ops/sec
  const REFERENCE_RATE = 1000e6;
  const perfBonus = Math.min(20, 20 * (avgOpsPerSec / REFERENCE_RATE));

  return {
    fn: fnName,
    sets: results,
    avgOpsPerSec,
    perfBonus,
  };
}

function computeOverallScore(results) {
  // Geometric mean of per-function total scores
  let logSum = 0;
  let count = 0;
  for (const r of results) {
    const accuracyScore = 100 / (1 + r.accuracy.meanUlp);
    const total = accuracyScore + r.perf.perfBonus;
    if (total > 0) {
      logSum += Math.log(total);
      count++;
    }
  }
  return count > 0 ? Math.exp(logSum / count) : 0;
}

// Run the full benchmark. `onProgress` is called with (fnName, phase, result).
// Returns array of {fn, accuracy, perf} objects.
async function runBenchmark(testData, onProgress) {
  const results = [];

  for (const fnName of FUNCTIONS) {
    const fnData = testData[fnName];
    if (!fnData) {
      if (onProgress) onProgress(fnName, 'skip', null);
      continue;
    }

    if (onProgress) onProgress(fnName, 'accuracy', null);
    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 0));

    const accuracy = runAccuracyTest(fnName, fnData);

    if (onProgress) onProgress(fnName, 'perf', null);
    await new Promise(r => setTimeout(r, 0));

    const perf = runPerfTest(fnName);

    const entry = { fn: fnName, accuracy, perf };
    results.push(entry);
    if (onProgress) onProgress(fnName, 'done', entry);
  }

  return results;
}

// Export for both browser and Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FUNCTIONS, runBenchmark, computeOverallScore, parseHexFloat, ulpError };
}
