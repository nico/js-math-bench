# Performance loop overhead: indirect calls vs direct calls

## Problem

When benchmarking Math functions, the performance measurement loop introduces
overhead that can mask the actual function performance. With the original
bench.js approach, over 50% of measured time for fast functions like `cbrt`
was loop overhead, not actual Math computation.

This was discovered when comparing a standalone `cbrt.js` microbenchmark
(which showed 75% slowdown after an implementation change) against
bench-standalone.js (which showed only 3% slowdown).

## Root cause

The original loop used an indirect function call:

```js
const fn = Math[fnName];
for (let i = 0; i < N; i++) dummy += fn(inputs[i]);
```

The JIT compiler cannot inline `fn()` because it's a generic function
variable. This adds significant call overhead per iteration.

## Attempted fix: closure factory

```js
function makeRunner(mathFn) {
  return function(arr, n) {
    var d = 0;
    for (var i = 0; i < n; i++) d += mathFn(arr[i]);
    return d;
  };
}
```

This works when only one closure is created, but V8 shares inline cache
feedback across all closures created by the same factory function. When
`makeRunner` is called for 22 different Math functions, the call site
becomes megamorphic and the JIT can't inline any of them.

Results with a single closure (monomorphic): 388M ops/s
Results with multiple closures (megamorphic): 137M ops/s

## Working fix: switch with direct calls

```js
function runUnaryLoop(fnName, arr, n) {
  var d = 0;
  switch (fnName) {
    case 'cbrt': for (var i = 0; i < n; i++) d += Math.cbrt(arr[i]); break;
    case 'sin':  for (var i = 0; i < n; i++) d += Math.sin(arr[i]); break;
    // ...
  }
  return d;
}
```

Each `Math.xxx()` call has its own source location, giving the JIT a
monomorphic call site it can inline. This is verbose but correct.

## Measurements (d8, Apple M-series, 100M iterations of Math.cbrt)

```
Method                         Time     Ops/sec
Tight loop (no array):          87ms    1155M    (baseline)
Switch + direct Math.cbrt():   259ms     386M    (array + accum overhead)
Closure factory (1 closure):   257ms     388M    (same as switch)
Closure factory (polluted):    729ms     137M    (megamorphic)
Indirect fn(inputs[i]):       1066ms      94M    (generic call)
```

## Impact on benchmark results

Before (indirect call) vs after (switch + direct calls):

```
Function       Before    After    Speedup
Math.sqrt       226M      1.5B    6.6x
Math.cbrt       135M      374M    2.8x
Math.sin         89M      149M    1.7x
```

Fast functions like sqrt were most affected because the overhead was a
larger fraction of total time.

## Test script

```js
var N = 100000;
var inputs = new Float64Array(N);
for (var j = 0; j < N; j++) inputs[j] = j;

// Approach 1: indirect call
var fn = Math.cbrt;
var start = performance.now();
var totalOps = 0, dummy = 0;
while (totalOps < 100000000) {
  for (var k = 0; k < N; k++) dummy += fn(inputs[k]);
  totalOps += N;
}
var t1 = performance.now() - start;

// Approach 2: closure (monomorphic -- only 1 closure created)
function makeRunner(mathFn) {
  return function(arr, n) {
    var d = 0;
    for (var i = 0; i < n; i++) d += mathFn(arr[i]);
    return d;
  };
}
var runCbrt = makeRunner(Math.cbrt);
for (var w = 0; w < 5; w++) runCbrt(inputs, N);
start = performance.now();
totalOps = 0; dummy = 0;
while (totalOps < 100000000) { dummy += runCbrt(inputs, N); totalOps += N; }
var t2 = performance.now() - start;

// Approach 3: closure (megamorphic -- multiple closures from same factory)
var runSin = makeRunner(Math.sin);
var runCos = makeRunner(Math.cos);
var runCbrt2 = makeRunner(Math.cbrt);
for (var w = 0; w < 5; w++) { runSin(inputs, N); runCos(inputs, N); runCbrt2(inputs, N); }
start = performance.now();
totalOps = 0; dummy = 0;
while (totalOps < 100000000) { dummy += runCbrt2(inputs, N); totalOps += N; }
var t3 = performance.now() - start;

// Approach 4: switch with direct calls
function runDirect(fn, arr, n) {
  var d = 0;
  switch (fn) {
    case 'cbrt': for (var i = 0; i < n; i++) d += Math.cbrt(arr[i]); break;
    case 'sin':  for (var i = 0; i < n; i++) d += Math.sin(arr[i]); break;
    case 'sqrt': for (var i = 0; i < n; i++) d += Math.sqrt(arr[i]); break;
  }
  return d;
}
for (var w = 0; w < 5; w++) runDirect('cbrt', inputs, N);
start = performance.now();
totalOps = 0; dummy = 0;
while (totalOps < 100000000) { dummy += runDirect('cbrt', inputs, N); totalOps += N; }
var t4 = performance.now() - start;

// Approach 5: tight loop
start = performance.now();
var i = 0;
while (i++ < 100000000) Math.cbrt(i);
var t5 = performance.now() - start;

print('Indirect fn(inputs[i]):         ' + t1.toFixed(0) + 'ms  (' + (100e6/t1*1000/1e6).toFixed(0) + 'M ops/s)');
print('Closure (monomorphic):          ' + t2.toFixed(0) + 'ms  (' + (100e6/t2*1000/1e6).toFixed(0) + 'M ops/s)');
print('Closure (megamorphic):          ' + t3.toFixed(0) + 'ms  (' + (100e6/t3*1000/1e6).toFixed(0) + 'M ops/s)');
print('Switch + direct Math.cbrt():    ' + t4.toFixed(0) + 'ms  (' + (100e6/t4*1000/1e6).toFixed(0) + 'M ops/s)');
print('Tight loop:                     ' + t5.toFixed(0) + 'ms  (' + (100e6/t5*1000/1e6).toFixed(0) + 'M ops/s)');
```
