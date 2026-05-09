# Data-dependent performance of JavaScript Math functions

## Summary

Math function performance can vary dramatically depending on the input range.
Trig functions (sin, cos, tan) are up to 11x slower for large inputs due to
argument reduction. Most other functions are nearly constant across ranges.

## Results (Node.js / V8, Apple M-series, May 2026)

```
Function              tiny       small      medium       large        huge   ratio
                [1e-300,    [0,1]     [1,100]   [1e6,1e10] [1e100,      max/
                 1e-100]                                    1e300]       min
--------------------------------------------------------------------------
Math.acos              N/A        269M         N/A         N/A         N/A    1.0x
Math.acosh             N/A         N/A         58M         63M        121M    2.1x
Math.asin             179M        137M         N/A         N/A         N/A    1.3x
Math.asinh            110M        103M        102M        115M        116M    1.1x
Math.atan             179M        135M        128M        129M        172M    1.4x
Math.atan2             85M        162M        181M        175M        179M    2.1x
Math.atanh             N/A         99M         N/A         N/A         N/A    1.0x
Math.cbrt             126M        127M        125M        127M        127M    1.0x
Math.cos              187M        128M         93M         19M         17M   11.1x
Math.cosh             167M        115M        112M        166M        158M    1.5x
Math.exp              188M        143M        135M        182M        177M    1.4x
Math.expm1            173M        131M        112M        179M        180M    1.6x
Math.log               N/A        132M        130M        133M        129M    1.0x
Math.log1p            175M        129M        123M        124M         N/A    1.4x
Math.log2              N/A        125M        123M        124M        127M    1.0x
Math.log10             N/A        104M        103M        102M        104M    1.0x
Math.pow               30M         42M         39M        101M        125M    4.2x
Math.sin              170M        139M         96M         19M         17M    9.8x
Math.sinh             173M        115M        115M        175M        170M    1.5x
Math.sqrt             192M        192M        193M        189M        191M    1.0x
Math.tan              166M        112M         84M         17M         16M   10.7x
Math.tanh             163M        108M        152M        185M        180M    1.7x
```

N/A = input range is outside the function's domain.

## Analysis

### Highly data-dependent (>4x variation)

**sin, cos, tan (10-11x):** These are the standout cases. For small inputs
([0, 1]), trig functions run at 128-170M ops/sec. For large inputs ([1e6, 1e10]
and above), they drop to 17-19M ops/sec -- an order of magnitude slower.

The cause is argument reduction: computing sin(x) for large x requires first
reducing x modulo 2*pi to a value in [-pi, pi]. For small x this is trivial,
but for x = 1e100 it requires computing x mod 2*pi to full double precision,
which involves extended-precision arithmetic (typically using the Payne-Hanek
algorithm or precomputed tables of 2/pi digits).

**pow (4.2x):** Slowest for tiny inputs near zero (30M ops/sec), fastest for
large inputs (125M). Different code paths handle: base near 0 or 1, integer
exponents, negative bases, and general cases.

### Moderately data-dependent (1.5-2.1x)

**acosh (2.1x):** Faster for large inputs where acosh(x) ~ log(2x) can be
used, slower for inputs near 1 where higher precision is needed.

**atan2 (2.1x):** Slowest for tiny inputs (85M), likely due to special-case
handling when both arguments are very small.

**cosh, sinh, exp, expm1, tanh (1.4-1.7x):** Some variation from fast paths
for inputs where the result overflows/underflows (returns Inf or 0 early) vs
the general case requiring full computation.

### Essentially constant (1.0-1.1x)

**sqrt (1.0x):** Perfectly uniform at ~192M ops/sec across all ranges. This
is expected -- sqrt is implemented as a single hardware instruction (FSQRT)
on modern CPUs, with constant latency regardless of input.

**cbrt, log, log2, log10 (1.0x):** These functions use algorithms that don't
have significantly different code paths for different input magnitudes. The
exponent is extracted, the mantissa is reduced to a small range, and the same
polynomial/rational approximation is applied regardless of the original
magnitude.

**asinh (1.1x):** Despite having multiple possible approximations (polynomial
near zero, log-based for large values), the variation is minimal.

## Implications for benchmarking

A benchmark that only tests inputs in [0, 1] would:
- Overstate trig function performance by up to 11x
- Overstate pow performance by up to 4x
- Give a misleading picture of real-world performance

js-math-bench tests three input ranges for each function to capture this
variation: [0, 1], [-10, 10], and integers [0, 100000).

## Test script

The following Node.js script was used to generate the results above:

```js
const fns = ['acos','acosh','asin','asinh','atan','atan2','atanh','cbrt',
  'cos','cosh','exp','expm1','log','log1p','log2','log10','pow',
  'sin','sinh','sqrt','tan','tanh'];

const ranges = {
  'tiny [1e-300,1e-100]': (i,N) => 1e-300 + (1e-100 - 1e-300) * i/N,
  'small [0,1]':          (i,N) => i/N,
  'medium [1,100]':       (i,N) => 1 + 99*i/N,
  'large [1e6,1e10]':     (i,N) => 1e6 + (1e10-1e6)*i/N,
  'huge [1e100,1e300]':   (i,N) => 1e100 + (1e300-1e100)*i/N,
};

// Valid input ranges per function (skip domains that would produce NaN)
const validRanges = {
  acos:  ['small [0,1]'],
  acosh: ['medium [1,100]', 'large [1e6,1e10]', 'huge [1e100,1e300]'],
  asin:  ['tiny [1e-300,1e-100]', 'small [0,1]'],
  atanh: ['small [0,1]'],
  log:   ['small [0,1]', 'medium [1,100]', 'large [1e6,1e10]', 'huge [1e100,1e300]'],
  log1p: ['tiny [1e-300,1e-100]', 'small [0,1]', 'medium [1,100]', 'large [1e6,1e10]'],
  log2:  ['small [0,1]', 'medium [1,100]', 'large [1e6,1e10]', 'huge [1e100,1e300]'],
  log10: ['small [0,1]', 'medium [1,100]', 'large [1e6,1e10]', 'huge [1e100,1e300]'],
  sqrt:  ['tiny [1e-300,1e-100]', 'small [0,1]', 'medium [1,100]',
          'large [1e6,1e10]', 'huge [1e100,1e300]'],
};
const allRanges = Object.keys(ranges);
const defaultRanges = Object.keys(ranges);

const N = 100000;
const MIN_MS = 20;

console.log('Function'.padEnd(14) +
  Object.keys(ranges).map(r => r.split(' ')[0].padStart(12)).join(''));
console.log('-'.repeat(14 + 12 * Object.keys(ranges).length));

for (const fn of fns) {
  const mathFn = Math[fn];
  const isBinary = fn === 'atan2' || fn === 'pow';
  const fnRanges = validRanges[fn] || defaultRanges;
  let row = ('Math.' + fn).padEnd(14);
  const results = {};

  for (const rName of allRanges) {
    if (!fnRanges.includes(rName)) {
      row += '         N/A';
      continue;
    }
    const gen = ranges[rName];
    const inputs = new Float64Array(N);
    for (let i = 0; i < N; i++) inputs[i] = gen(i, N);

    // warmup
    for (let i = 0; i < 1000; i++) mathFn(inputs[i]);

    let ops = 0;
    const start = performance.now();
    const deadline = start + MIN_MS;
    while (performance.now() < deadline) {
      let dummy = 0;
      if (isBinary) {
        for (let i = 0; i < N; i++) dummy += mathFn(inputs[i], inputs[(i+500)%N]);
      } else {
        for (let i = 0; i < N; i++) dummy += mathFn(inputs[i]);
      }
      ops += N;
      if (dummy !== dummy + 1) void 0;
    }
    const elapsed = performance.now() - start;
    const mops = (ops / elapsed) * 1000 / 1e6;
    row += (mops.toFixed(0) + 'M').padStart(12);
    results[rName] = mops;
  }

  const vals = Object.values(results);
  const ratio = (Math.max(...vals) / Math.min(...vals)).toFixed(1);
  row += (ratio + 'x').padStart(8);
  console.log(row);
}
```
