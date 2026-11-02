// js-math-bench: "weird output" benchmark
// Measures the performance of Math functions on inputs whose result is
// special: +/-Infinity, NaN, zero, a denormal, or a saturated constant
// (tanh(x) = 1 exactly for x >= 20, atan(x) = pi/2 for huge x, ...). libm
// implementations usually handle these on separate code paths
// (overflow/underflow handling, domain checks, exception flag raising, early
// exits), which can be much slower -- or much faster -- than the normal path.
//
// Only functions that can produce such a result from some input are included.
// NaN -> NaN propagation alone doesn't qualify (every function does that), and
// neither does returning a denormal input unchanged (sin(x) = x for tiny x).
// Saturation cases only use inputs for which the correctly rounded result is
// exactly the constant, with a safety margin.
//
// Requires bench.js (shared function list, perf loop and PRNG).

'use strict';

// In Node, pull bench.js in via require. In the browser, bench.js is loaded
// as a <script> first and its top-level bindings are visible here.
const B = (typeof module !== 'undefined' && module.exports) ? require('./bench.js')
  : { FUNCTIONS, BINARY_FUNCTIONS, PERF_RANGES, BINARY_PERF_RANGES, PERF_N, mulberry32, measureOpsPerSec };

const DBL_MAX = 1.7976931348623157e+308;
const DBL_MIN = 2.2250738585072014e-308;  // smallest normal
const PI = Math.PI;
const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;

// --- Expected-result classes ---

const isInf = y => y === Infinity;
const isNegInf = y => y === -Infinity;
const isNaNv = y => y !== y;
const isZero = y => y === 0;
const isDenormal = y => y !== 0 && Math.abs(y) < DBL_MIN;

const EXPECT = {
  inf:      { name: '+Inf',     check: isInf },
  negInf:   { name: '-Inf',     check: isNegInf },
  nan:      { name: 'NaN',      check: isNaNv },
  zero:     { name: '0',        check: isZero },
  denormal: { name: 'denormal', check: isDenormal },
  // Sign of the result must match the sign of the (first) input.
  signedInf: { name: '+/-Inf', check: (y, x) => y === (x < 0 ? -Infinity : Infinity) },
  // Saturation: the correctly rounded result is exactly a constant.
  negOne:    { name: '-1',       check: y => y === -1 },
  signedOne: { name: '+/-1',     check: (y, x) => y === (x < 0 ? -1 : 1) },
  signedHalfPi: { name: '+/-pi/2', check: (y, x) => y === (x < 0 ? -HALF_PI : HALF_PI) },
  signedPi:  { name: '+/-pi',    check: (y, x) => y === (x < 0 ? -PI : PI) },
  signedQuarterPi: { name: '+/-pi/4', check: (y, x) => y === (x < 0 ? -QUARTER_PI : QUARTER_PI) },
};

// --- Input generators ---
// Each takes the PRNG and returns one input (unary) or an [a, b] pair (binary).

function uni(lo, hi) {
  return rng => lo + rng() * (hi - lo);
}
// Log-uniform in magnitude: 2^uniform(lo, hi), with the given sign.
function pow2(lo, hi, sign) {
  return rng => (sign || 1) * Math.pow(2, lo + rng() * (hi - lo));
}
// Random sign applied to another generator.
function pm(gen) {
  return rng => (rng() < 0.5 ? -1 : 1) * gen(rng);
}
// Cycle through fixed values.
function cycle(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
function pair(genA, genB) {
  return rng => [genA(rng), genB(rng)];
}

const INFS = cycle([Infinity, -Infinity]);
const NAN = () => NaN;
const NORMAL = uni(-10, 10);

// --- Cases ---
// Per function: a list of {label, expect, gen}. Labels describe the inputs;
// `expect` is the result class every output must fall into.

const WEIRD_CASES = {
  exp: [
    { label: 'x in [710, 1e4]',     expect: 'inf',      gen: uni(710, 1e4) },
    { label: 'x in [-1e4, -746]',   expect: 'zero',     gen: uni(-1e4, -746) },
    { label: 'x in [-744, -709]',   expect: 'denormal', gen: uni(-744, -709) },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'zero',     gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  expm1: [
    { label: 'x in [710, 1e4]',     expect: 'inf',      gen: uni(710, 1e4) },
    // exp(x) < 2^-54 for x < -37.43, so expm1(x) rounds to exactly -1.
    { label: 'x in [-1e4, -38]',    expect: 'negOne',   gen: uni(-1e4, -38) },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'negOne',   gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  tanh: [
    // 1 - tanh(x) < 2^-54 for x > 19.06, so tanh(x) rounds to exactly +/-1.
    { label: '|x| in [20, 1e4]',    expect: 'signedOne', gen: pm(uni(20, 1e4)) },
    { label: 'x = +/-Inf',          expect: 'signedOne', gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  atan: [
    // pi/2 - atan(x) = 1/x < 2^-56 is well below the rounding margin of pi/2.
    { label: '|x| in 2^[56, 1000]', expect: 'signedHalfPi', gen: pm(pow2(56, 1000)) },
    { label: 'x = +/-Inf',          expect: 'signedHalfPi', gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  cosh: [
    { label: '|x| in [711, 1e4]',   expect: 'inf',      gen: pm(uni(711, 1e4)) },
    { label: 'x = +/-Inf',          expect: 'inf',      gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  sinh: [
    { label: '|x| in [711, 1e4]',   expect: 'signedInf', gen: pm(uni(711, 1e4)) },
    { label: 'x = +/-Inf',          expect: 'signedInf', gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  log: [
    { label: 'x < 0',               expect: 'nan',      gen: pow2(-1000, 1000, -1) },
    { label: 'x = +/-0',            expect: 'negInf',   gen: cycle([0, -0]) },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'nan',      gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  log1p: [
    { label: 'x < -1',              expect: 'nan',      gen: uni(-1e6, -1.001) },
    { label: 'x = -1',              expect: 'negInf',   gen: () => -1 },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'nan',      gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  sqrt: [
    { label: 'x < 0',               expect: 'nan',      gen: pow2(-1000, 1000, -1) },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'nan',      gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  acos: [
    { label: '|x| > 1',             expect: 'nan',      gen: pm(pow2(0.001, 1000)) },
    { label: 'x = +/-Inf',          expect: 'nan',      gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  acosh: [
    { label: 'x < 1',               expect: 'nan',      gen: uni(-1e6, 0.999) },
    { label: 'x = +Inf',            expect: 'inf',      gen: () => Infinity },
    { label: 'x = -Inf',            expect: 'nan',      gen: () => -Infinity },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  atanh: [
    { label: '|x| > 1',             expect: 'nan',      gen: pm(pow2(0.001, 1000)) },
    { label: 'x = +/-1',            expect: 'signedInf', gen: cycle([1, -1]) },
    { label: 'x = +/-Inf',          expect: 'nan',      gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  asinh: [
    { label: 'x = +/-Inf',          expect: 'signedInf', gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  cbrt: [
    { label: 'x = +/-Inf',          expect: 'signedInf', gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  sin: [
    { label: 'x = +/-Inf',          expect: 'nan',      gen: INFS },
    { label: 'x = NaN',             expect: 'nan',      gen: NAN },
  ],
  atan2: [
    { label: '|y| in 2^[600,1000], x in [-10,10]', expect: 'signedHalfPi', gen: pair(pm(pow2(600, 1000)), NORMAL) },
    { label: '|y| in [0.5,10], x in -2^[600,1000]', expect: 'signedPi',  gen: pair(pm(uni(0.5, 10)), pow2(600, 1000, -1)) },
    { label: 'y in [-10,10], x = +Inf',          expect: 'zero',         gen: pair(NORMAL, () => Infinity) },
    { label: 'y in [-10,10], x = -Inf',          expect: 'signedPi',     gen: pair(NORMAL, () => -Infinity) },
    { label: 'y = +/-Inf, x in [-10,10]',        expect: 'signedHalfPi', gen: pair(INFS, NORMAL) },
    { label: 'y = +/-Inf, x = +Inf',             expect: 'signedQuarterPi', gen: pair(INFS, () => Infinity) },
    { label: 'y = NaN',                          expect: 'nan',          gen: pair(NAN, NORMAL) },
  ],
  pow: [
    { label: 'b in [2,10], e in [1100,2000]',   expect: 'inf',      gen: pair(uni(2, 10), uni(1100, 2000)) },
    { label: 'b in [2,10], e in [-2000,-1100]', expect: 'zero',     gen: pair(uni(2, 10), uni(-2000, -1100)) },
    // Pick e so that b^e = 2^-(1023..1073), i.e. the result is denormal.
    { label: 'b in [2,4], b^e in 2^[-1073,-1023]', expect: 'denormal',
      gen: rng => { const b = 2 + 2 * rng(); return [b, -(1023 + 50 * rng()) / Math.log2(b)]; } },
    { label: 'b < 0, e non-integer',            expect: 'nan',      gen: pair(uni(-100, -0.01), uni(0.1, 10)) },
    { label: 'b = +0, e < 0',                   expect: 'inf',      gen: pair(() => 0, uni(-10, -0.5)) },
    { label: 'b = +Inf, e > 0',                 expect: 'inf',      gen: pair(() => Infinity, uni(0.5, 10)) },
    { label: '|b| > 1, e = +Inf',               expect: 'inf',      gen: pair(pm(uni(1.5, 10)), () => Infinity) },
    { label: 'b = NaN, e != 0',                 expect: 'nan',      gen: pair(NAN, uni(0.5, 10)) },
  ],
};

// hypot overflows for huge inputs, returns +Inf if any input is +/-Inf (even
// alongside a NaN), NaN for a NaN input, and a denormal for tiny inputs.
const HYPOT_CASES = [
  { label: 'a, b in [1.3e308, 1.7e308]', expect: 'inf',    gen: pair(uni(1.3e308, 1.7e308), uni(1.3e308, 1.7e308)) },
  { label: 'a, b in [5e-324, 1e-310]', expect: 'denormal', gen: pair(uni(5e-324, 1e-310), uni(5e-324, 1e-310)) },
  { label: 'a = +/-Inf',               expect: 'inf',      gen: pair(INFS, NORMAL) },
  { label: 'a = +/-Inf, b = NaN',      expect: 'inf',      gen: pair(INFS, NAN) },
  { label: 'a = NaN',                  expect: 'nan',      gen: pair(NAN, NORMAL) },
];
WEIRD_CASES.hypot = HYPOT_CASES;
WEIRD_CASES.hypot3 = HYPOT_CASES;
WEIRD_CASES.hypot4 = HYPOT_CASES;

// Functions with identical special-value behavior share a case list.
WEIRD_CASES.log2 = WEIRD_CASES.log;
WEIRD_CASES.log10 = WEIRD_CASES.log;
WEIRD_CASES.asin = WEIRD_CASES.acos;
WEIRD_CASES.cos = WEIRD_CASES.sin;
WEIRD_CASES.tan = WEIRD_CASES.sin;

// Same order as the main benchmark.
const WEIRD_FUNCTIONS = B.FUNCTIONS.filter(f => WEIRD_CASES[f]);

// --- Running ---

function describeValue(v) {
  if (Object.is(v, -0)) return '-0';
  return String(v);
}

function callExprFor(fnName, args) {
  const s = args.map(describeValue);
  if (fnName === 'hypot3') return 'Math.hypot(' + s[0] + ', 0, ' + s[1] + ')';
  if (fnName === 'hypot4') return 'Math.hypot(' + s[0] + ', 0, 0, ' + s[1] + ')';
  return 'Math.' + fnName + '(' + s.join(', ') + ')';
}

function callFn(fnName, a, b) {
  if (fnName === 'hypot3') return Math.hypot(a, 0, b);
  if (fnName === 'hypot4') return Math.hypot(a, 0, 0, b);
  return B.BINARY_FUNCTIONS.has(fnName) ? Math[fnName](a, b) : Math[fnName](a);
}

function generateInputs(fnName, gen, rng) {
  const N = B.PERF_N;
  if (B.BINARY_FUNCTIONS.has(fnName)) {
    const a = new Float64Array(N), b = new Float64Array(N);
    for (let i = 0; i < N; i++) { const p = gen(rng); a[i] = p[0]; b[i] = p[1]; }
    return { a, b };
  }
  const arr = new Float64Array(N);
  for (let i = 0; i < N; i++) arr[i] = gen(rng);
  return arr;
}

// The "normal" baseline: the middle range of the main benchmark's perf sets.
function baselineInputs(fnName, rng) {
  if (B.BINARY_FUNCTIONS.has(fnName)) {
    const [[aLo, aHi], [bLo, bHi]] = B.BINARY_PERF_RANGES[fnName][1];
    return {
      label: '[' + aLo + ',' + aHi + ']x[' + bLo + ',' + bHi + ']',
      inputs: generateInputs(fnName, pair(uni(aLo, aHi), uni(bLo, bHi)), rng),
    };
  }
  const [lo, hi] = (B.PERF_RANGES[fnName] || [[0, 1], [-10, 10], [0, 1e5]])[1];
  return { label: '[' + lo + ',' + hi + ']', inputs: generateInputs(fnName, uni(lo, hi), rng) };
}

// Check that every output falls into the expected class. Returns
// {mismatches, example: {args, got}}.
function verifyOutputs(fnName, inputs, expect) {
  const isBinary = B.BINARY_FUNCTIONS.has(fnName);
  const N = isBinary ? inputs.a.length : inputs.length;
  let mismatches = 0;
  let example = null;
  for (let i = 0; i < N; i++) {
    const a = isBinary ? inputs.a[i] : inputs[i];
    const b = isBinary ? inputs.b[i] : undefined;
    const y = callFn(fnName, a, b);
    if (!expect.check(y, a, b)) {
      mismatches++;
      if (!example) example = { args: isBinary ? [a, b] : [a], got: y };
    }
  }
  return { mismatches, example };
}

function runWeirdFunction(fnName) {
  const rng = B.mulberry32(0x12345678);
  const base = baselineInputs(fnName, rng);
  const baselineOps = B.measureOpsPerSec(fnName, base.inputs);

  const cases = [];
  for (const c of WEIRD_CASES[fnName]) {
    const expect = EXPECT[c.expect];
    const inputs = generateInputs(fnName, c.gen, rng);
    const { mismatches, example } = verifyOutputs(fnName, inputs, expect);
    const opsPerSec = B.measureOpsPerSec(fnName, inputs);
    cases.push({
      label: c.label,
      expect: expect.name,
      opsPerSec,
      nsPerCall: 1e9 / opsPerSec,
      ratio: opsPerSec / baselineOps,
      mismatches,
      example: example && { expr: callExprFor(fnName, example.args), got: describeValue(example.got) },
    });
  }

  return {
    fn: fnName,
    baseline: { label: base.label, opsPerSec: baselineOps, nsPerCall: 1e9 / baselineOps },
    cases,
  };
}

// Geometric mean of weird-path speed relative to the normal path, over all
// cases of all functions. 1.0 = weird inputs run as fast as normal ones.
function computeWeirdSummary(results) {
  let logSum = 0, count = 0, mismatched = 0, total = 0;
  let slowest = null;
  for (const r of results) {
    for (const c of r.cases) {
      logSum += Math.log(c.ratio);
      count++;
      total++;
      if (c.mismatches > 0) mismatched++;
      if (!slowest || c.ratio < slowest.ratio) slowest = { fn: r.fn, label: c.label, ratio: c.ratio };
    }
  }
  return {
    meanRatio: count > 0 ? Math.exp(logSum / count) : 0,
    cases: total,
    mismatchedCases: mismatched,
    slowest,
  };
}

// Run the benchmark. `onProgress` is called with (fnName, phase, result),
// phase being 'run' or 'done'. `functions` defaults to all of WEIRD_FUNCTIONS.
async function runWeirdBenchmark(onProgress, functions) {
  const results = [];
  for (const fnName of functions || WEIRD_FUNCTIONS) {
    if (onProgress) onProgress(fnName, 'run', null);
    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 0));
    const result = runWeirdFunction(fnName);
    results.push(result);
    if (onProgress) onProgress(fnName, 'done', result);
  }
  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEIRD_FUNCTIONS, WEIRD_CASES, runWeirdBenchmark, computeWeirdSummary };
}
