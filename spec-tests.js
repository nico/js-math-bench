// ECMAScript spec compliance tests for Math functions.
// Tests corner cases: NaN, +/-Infinity, +/-0, domain boundaries.
// Reference: https://tc39.es/ecma262/#sec-math

'use strict';

// --- Helpers ---

function describe(x) {
  if (typeof x === 'string') return x;
  if (Object.is(x, -0)) return '-0';
  if (Object.is(x, +0)) return '+0';
  if (x !== x) return 'NaN';
  if (x === Infinity) return '+Inf';
  if (x === -Infinity) return '-Inf';
  return String(x);
}

function same(a, b) {
  return Object.is(a, b) || (a !== a && b !== b);
}

var NAN = NaN;
var INF = Infinity;
var NEG_INF = -Infinity;
var POS_ZERO = +0;
var NEG_ZERO = -0;
var PI = Math.PI;
var PI_2 = Math.PI / 2;
var PI_4 = Math.PI / 4;
var THREE_PI_4 = 3 * Math.PI / 4;

// --- Test case definitions ---
// Each: [functionName, args, expected, description]

var tests = [];

function t(fn, args, expected, desc) {
  tests.push({fn: fn, args: args, expected: expected, desc: desc});
}

// == Math.acos ==
// If x is NaN, return NaN.
t('acos', [NAN], NAN, 'acos(NaN) = NaN');
// If x > 1, return NaN.
t('acos', [1.1], NAN, 'acos(x > 1) = NaN');
// If x < -1, return NaN.
t('acos', [-1.1], NAN, 'acos(x < -1) = NaN');
// If x is 1, return +0.
t('acos', [1], POS_ZERO, 'acos(1) = +0');
t('acos', [INF], NAN, 'acos(+Inf) = NaN');
t('acos', [NEG_INF], NAN, 'acos(-Inf) = NaN');

// == Math.acosh ==
// If x is NaN, return NaN.
t('acosh', [NAN], NAN, 'acosh(NaN) = NaN');
// If x < 1, return NaN.
t('acosh', [0.5], NAN, 'acosh(x < 1) = NaN');
t('acosh', [-1], NAN, 'acosh(-1) = NaN');
// If x is 1, return +0.
t('acosh', [1], POS_ZERO, 'acosh(1) = +0');
// If x is +Inf, return +Inf.
t('acosh', [INF], INF, 'acosh(+Inf) = +Inf');
t('acosh', [NEG_INF], NAN, 'acosh(-Inf) = NaN');

// == Math.asin ==
// If x is NaN, return NaN.
t('asin', [NAN], NAN, 'asin(NaN) = NaN');
// If x > 1, return NaN.
t('asin', [1.1], NAN, 'asin(x > 1) = NaN');
// If x < -1, return NaN.
t('asin', [-1.1], NAN, 'asin(x < -1) = NaN');
// If x is +0, return +0.
t('asin', [POS_ZERO], POS_ZERO, 'asin(+0) = +0');
// If x is -0, return -0.
t('asin', [NEG_ZERO], NEG_ZERO, 'asin(-0) = -0');
t('asin', [INF], NAN, 'asin(+Inf) = NaN');
t('asin', [NEG_INF], NAN, 'asin(-Inf) = NaN');

// == Math.asinh ==
// If x is NaN, return NaN.
t('asinh', [NAN], NAN, 'asinh(NaN) = NaN');
// If x is +0, return +0.
t('asinh', [POS_ZERO], POS_ZERO, 'asinh(+0) = +0');
// If x is -0, return -0.
t('asinh', [NEG_ZERO], NEG_ZERO, 'asinh(-0) = -0');
// If x is +Inf, return +Inf.
t('asinh', [INF], INF, 'asinh(+Inf) = +Inf');
// If x is -Inf, return -Inf.
t('asinh', [NEG_INF], NEG_INF, 'asinh(-Inf) = -Inf');

// == Math.atan ==
// If x is NaN, return NaN.
t('atan', [NAN], NAN, 'atan(NaN) = NaN');
// If x is +0, return +0.
t('atan', [POS_ZERO], POS_ZERO, 'atan(+0) = +0');
// If x is -0, return -0.
t('atan', [NEG_ZERO], NEG_ZERO, 'atan(-0) = -0');
// If x is +Inf, return pi/2.
t('atan', [INF], PI_2, 'atan(+Inf) = +pi/2');
// If x is -Inf, return -pi/2.
t('atan', [NEG_INF], -PI_2, 'atan(-Inf) = -pi/2');

// == Math.atan2 ==
// If y is NaN or x is NaN, return NaN.
t('atan2', [NAN, 1], NAN, 'atan2(NaN, 1) = NaN');
t('atan2', [1, NAN], NAN, 'atan2(1, NaN) = NaN');
t('atan2', [NAN, NAN], NAN, 'atan2(NaN, NaN) = NaN');
// If y > 0 and x is +0, return pi/2.
t('atan2', [1, POS_ZERO], PI_2, 'atan2(y>0, +0) = +pi/2');
// If y > 0 and x is -0, return pi/2.
t('atan2', [1, NEG_ZERO], PI_2, 'atan2(y>0, -0) = +pi/2');
// If y is +0 and x > 0, return +0.
t('atan2', [POS_ZERO, 1], POS_ZERO, 'atan2(+0, x>0) = +0');
// If y is +0 and x is +0, return +0.
t('atan2', [POS_ZERO, POS_ZERO], POS_ZERO, 'atan2(+0, +0) = +0');
// If y is +0 and x is -0, return pi.
t('atan2', [POS_ZERO, NEG_ZERO], PI, 'atan2(+0, -0) = +pi');
// If y is +0 and x < 0, return pi.
t('atan2', [POS_ZERO, -1], PI, 'atan2(+0, x<0) = +pi');
// If y is -0 and x > 0, return -0.
t('atan2', [NEG_ZERO, 1], NEG_ZERO, 'atan2(-0, x>0) = -0');
// If y is -0 and x is +0, return -0.
t('atan2', [NEG_ZERO, POS_ZERO], NEG_ZERO, 'atan2(-0, +0) = -0');
// If y is -0 and x is -0, return -pi.
t('atan2', [NEG_ZERO, NEG_ZERO], -PI, 'atan2(-0, -0) = -pi');
// If y is -0 and x < 0, return -pi.
t('atan2', [NEG_ZERO, -1], -PI, 'atan2(-0, x<0) = -pi');
// If y < 0 and x is +0, return -pi/2.
t('atan2', [-1, POS_ZERO], -PI_2, 'atan2(y<0, +0) = -pi/2');
// If y < 0 and x is -0, return -pi/2.
t('atan2', [-1, NEG_ZERO], -PI_2, 'atan2(y<0, -0) = -pi/2');
// If y > 0 and y is finite and x is +Inf, return +0.
t('atan2', [1, INF], POS_ZERO, 'atan2(y>0, +Inf) = +0');
// If y > 0 and y is finite and x is -Inf, return pi.
t('atan2', [1, NEG_INF], PI, 'atan2(y>0, -Inf) = +pi');
// If y < 0 and y is finite and x is +Inf, return -0.
t('atan2', [-1, INF], NEG_ZERO, 'atan2(y<0, +Inf) = -0');
// If y < 0 and y is finite and x is -Inf, return -pi.
t('atan2', [-1, NEG_INF], -PI, 'atan2(y<0, -Inf) = -pi');
// If y is +Inf and x is finite, return pi/2.
t('atan2', [INF, 1], PI_2, 'atan2(+Inf, finite) = +pi/2');
t('atan2', [INF, -1], PI_2, 'atan2(+Inf, -finite) = +pi/2');
// If y is -Inf and x is finite, return -pi/2.
t('atan2', [NEG_INF, 1], -PI_2, 'atan2(-Inf, finite) = -pi/2');
t('atan2', [NEG_INF, -1], -PI_2, 'atan2(-Inf, -finite) = -pi/2');
// If y is +Inf and x is +Inf, return pi/4.
t('atan2', [INF, INF], PI_4, 'atan2(+Inf, +Inf) = +pi/4');
// If y is +Inf and x is -Inf, return 3*pi/4.
t('atan2', [INF, NEG_INF], THREE_PI_4, 'atan2(+Inf, -Inf) = +3pi/4');
// If y is -Inf and x is +Inf, return -pi/4.
t('atan2', [NEG_INF, INF], -PI_4, 'atan2(-Inf, +Inf) = -pi/4');
// If y is -Inf and x is -Inf, return -3*pi/4.
t('atan2', [NEG_INF, NEG_INF], -THREE_PI_4, 'atan2(-Inf, -Inf) = -3pi/4');

// == Math.atanh ==
// If x is NaN, return NaN.
t('atanh', [NAN], NAN, 'atanh(NaN) = NaN');
// If x > 1, return NaN.
t('atanh', [1.1], NAN, 'atanh(x > 1) = NaN');
// If x < -1, return NaN.
t('atanh', [-1.1], NAN, 'atanh(x < -1) = NaN');
// If x is 1, return +Inf.
t('atanh', [1], INF, 'atanh(1) = +Inf');
// If x is -1, return -Inf.
t('atanh', [-1], NEG_INF, 'atanh(-1) = -Inf');
// If x is +0, return +0.
t('atanh', [POS_ZERO], POS_ZERO, 'atanh(+0) = +0');
// If x is -0, return -0.
t('atanh', [NEG_ZERO], NEG_ZERO, 'atanh(-0) = -0');
t('atanh', [INF], NAN, 'atanh(+Inf) = NaN');
t('atanh', [NEG_INF], NAN, 'atanh(-Inf) = NaN');

// == Math.cbrt ==
// If x is NaN, return NaN.
t('cbrt', [NAN], NAN, 'cbrt(NaN) = NaN');
// If x is +0, return +0.
t('cbrt', [POS_ZERO], POS_ZERO, 'cbrt(+0) = +0');
// If x is -0, return -0.
t('cbrt', [NEG_ZERO], NEG_ZERO, 'cbrt(-0) = -0');
// If x is +Inf, return +Inf.
t('cbrt', [INF], INF, 'cbrt(+Inf) = +Inf');
// If x is -Inf, return -Inf.
t('cbrt', [NEG_INF], NEG_INF, 'cbrt(-Inf) = -Inf');

// == Math.cos ==
// If x is NaN, return NaN.
t('cos', [NAN], NAN, 'cos(NaN) = NaN');
// If x is +Inf, return NaN.
t('cos', [INF], NAN, 'cos(+Inf) = NaN');
// If x is -Inf, return NaN.
t('cos', [NEG_INF], NAN, 'cos(-Inf) = NaN');
// If x is +0, return 1.
t('cos', [POS_ZERO], 1, 'cos(+0) = 1');
// If x is -0, return 1.
t('cos', [NEG_ZERO], 1, 'cos(-0) = 1');

// == Math.cosh ==
// If x is NaN, return NaN.
t('cosh', [NAN], NAN, 'cosh(NaN) = NaN');
// If x is +0, return 1.
t('cosh', [POS_ZERO], 1, 'cosh(+0) = 1');
// If x is -0, return 1.
t('cosh', [NEG_ZERO], 1, 'cosh(-0) = 1');
// If x is +Inf, return +Inf.
t('cosh', [INF], INF, 'cosh(+Inf) = +Inf');
// If x is -Inf, return +Inf.
t('cosh', [NEG_INF], INF, 'cosh(-Inf) = +Inf');

// == Math.exp ==
// If x is NaN, return NaN.
t('exp', [NAN], NAN, 'exp(NaN) = NaN');
// If x is +0, return 1.
t('exp', [POS_ZERO], 1, 'exp(+0) = 1');
// If x is -0, return 1.
t('exp', [NEG_ZERO], 1, 'exp(-0) = 1');
// If x is +Inf, return +Inf.
t('exp', [INF], INF, 'exp(+Inf) = +Inf');
// If x is -Inf, return +0.
t('exp', [NEG_INF], POS_ZERO, 'exp(-Inf) = +0');

// == Math.expm1 ==
// If x is NaN, return NaN.
t('expm1', [NAN], NAN, 'expm1(NaN) = NaN');
// If x is +0, return +0.
t('expm1', [POS_ZERO], POS_ZERO, 'expm1(+0) = +0');
// If x is -0, return -0.
t('expm1', [NEG_ZERO], NEG_ZERO, 'expm1(-0) = -0');
// If x is +Inf, return +Inf.
t('expm1', [INF], INF, 'expm1(+Inf) = +Inf');
// If x is -Inf, return -1.
t('expm1', [NEG_INF], -1, 'expm1(-Inf) = -1');

// == Math.log ==
// If x is NaN, return NaN.
t('log', [NAN], NAN, 'log(NaN) = NaN');
// If x < 0, return NaN.
t('log', [-1], NAN, 'log(x < 0) = NaN');
// If x is +0, return -Inf.
t('log', [POS_ZERO], NEG_INF, 'log(+0) = -Inf');
// If x is -0, return -Inf.
t('log', [NEG_ZERO], NEG_INF, 'log(-0) = -Inf');
// If x is 1, return +0.
t('log', [1], POS_ZERO, 'log(1) = +0');
// If x is +Inf, return +Inf.
t('log', [INF], INF, 'log(+Inf) = +Inf');
t('log', [NEG_INF], NAN, 'log(-Inf) = NaN');

// == Math.log1p ==
// If x is NaN, return NaN.
t('log1p', [NAN], NAN, 'log1p(NaN) = NaN');
// If x < -1, return NaN.
t('log1p', [-2], NAN, 'log1p(x < -1) = NaN');
// If x is -1, return -Inf.
t('log1p', [-1], NEG_INF, 'log1p(-1) = -Inf');
// If x is +0, return +0.
t('log1p', [POS_ZERO], POS_ZERO, 'log1p(+0) = +0');
// If x is -0, return -0.
t('log1p', [NEG_ZERO], NEG_ZERO, 'log1p(-0) = -0');
// If x is +Inf, return +Inf.
t('log1p', [INF], INF, 'log1p(+Inf) = +Inf');
t('log1p', [NEG_INF], NAN, 'log1p(-Inf) = NaN');

// == Math.log2 ==
// If x is NaN, return NaN.
t('log2', [NAN], NAN, 'log2(NaN) = NaN');
// If x < 0, return NaN.
t('log2', [-1], NAN, 'log2(x < 0) = NaN');
// If x is +0, return -Inf.
t('log2', [POS_ZERO], NEG_INF, 'log2(+0) = -Inf');
// If x is -0, return -Inf.
t('log2', [NEG_ZERO], NEG_INF, 'log2(-0) = -Inf');
// If x is 1, return +0.
t('log2', [1], POS_ZERO, 'log2(1) = +0');
// If x is +Inf, return +Inf.
t('log2', [INF], INF, 'log2(+Inf) = +Inf');
t('log2', [NEG_INF], NAN, 'log2(-Inf) = NaN');

// == Math.log10 ==
// If x is NaN, return NaN.
t('log10', [NAN], NAN, 'log10(NaN) = NaN');
// If x < 0, return NaN.
t('log10', [-1], NAN, 'log10(x < 0) = NaN');
// If x is +0, return -Inf.
t('log10', [POS_ZERO], NEG_INF, 'log10(+0) = -Inf');
// If x is -0, return -Inf.
t('log10', [NEG_ZERO], NEG_INF, 'log10(-0) = -Inf');
// If x is 1, return +0.
t('log10', [1], POS_ZERO, 'log10(1) = +0');
// If x is +Inf, return +Inf.
t('log10', [INF], INF, 'log10(+Inf) = +Inf');
t('log10', [NEG_INF], NAN, 'log10(-Inf) = NaN');

// == Math.pow ==
// If exponent is +0 or -0, return 1 (for ANY base, including NaN).
t('pow', [NAN, POS_ZERO], 1, 'pow(NaN, +0) = 1');
t('pow', [NAN, NEG_ZERO], 1, 'pow(NaN, -0) = 1');
t('pow', [INF, POS_ZERO], 1, 'pow(+Inf, +0) = 1');
t('pow', [NEG_INF, POS_ZERO], 1, 'pow(-Inf, +0) = 1');
t('pow', [POS_ZERO, POS_ZERO], 1, 'pow(+0, +0) = 1');
t('pow', [NEG_ZERO, POS_ZERO], 1, 'pow(-0, +0) = 1');
// If base is NaN and exponent is nonzero, return NaN.
t('pow', [NAN, 1], NAN, 'pow(NaN, 1) = NaN');
t('pow', [NAN, -1], NAN, 'pow(NaN, -1) = NaN');
t('pow', [NAN, INF], NAN, 'pow(NaN, +Inf) = NaN');
// If abs(base) > 1 and exponent is +Inf, return +Inf.
t('pow', [2, INF], INF, 'pow(2, +Inf) = +Inf');
t('pow', [-2, INF], INF, 'pow(-2, +Inf) = +Inf');
// If abs(base) > 1 and exponent is -Inf, return +0.
t('pow', [2, NEG_INF], POS_ZERO, 'pow(2, -Inf) = +0');
t('pow', [-2, NEG_INF], POS_ZERO, 'pow(-2, -Inf) = +0');
// If abs(base) is 1 and exponent is +Inf or -Inf, return NaN.
t('pow', [1, INF], NAN, 'pow(1, +Inf) = NaN');
t('pow', [1, NEG_INF], NAN, 'pow(1, -Inf) = NaN');
t('pow', [-1, INF], NAN, 'pow(-1, +Inf) = NaN');
t('pow', [-1, NEG_INF], NAN, 'pow(-1, -Inf) = NaN');
// If abs(base) < 1 and exponent is +Inf, return +0.
t('pow', [0.5, INF], POS_ZERO, 'pow(0.5, +Inf) = +0');
t('pow', [-0.5, INF], POS_ZERO, 'pow(-0.5, +Inf) = +0');
// If abs(base) < 1 and exponent is -Inf, return +Inf.
t('pow', [0.5, NEG_INF], INF, 'pow(0.5, -Inf) = +Inf');
t('pow', [-0.5, NEG_INF], INF, 'pow(-0.5, -Inf) = +Inf');
// If base is +Inf and exponent > 0, return +Inf.
t('pow', [INF, 1], INF, 'pow(+Inf, 1) = +Inf');
t('pow', [INF, 2], INF, 'pow(+Inf, 2) = +Inf');
// If base is +Inf and exponent < 0, return +0.
t('pow', [INF, -1], POS_ZERO, 'pow(+Inf, -1) = +0');
t('pow', [INF, -2], POS_ZERO, 'pow(+Inf, -2) = +0');
// If base is -Inf and exponent > 0 and exponent is odd integer, return -Inf.
t('pow', [NEG_INF, 1], NEG_INF, 'pow(-Inf, 1) = -Inf');
t('pow', [NEG_INF, 3], NEG_INF, 'pow(-Inf, 3) = -Inf');
// If base is -Inf and exponent > 0 and exponent is not odd integer, return +Inf.
t('pow', [NEG_INF, 2], INF, 'pow(-Inf, 2) = +Inf');
t('pow', [NEG_INF, 4], INF, 'pow(-Inf, 4) = +Inf');
t('pow', [NEG_INF, 0.5], INF, 'pow(-Inf, 0.5) = +Inf');
// If base is -Inf and exponent < 0 and exponent is odd integer, return -0.
t('pow', [NEG_INF, -1], NEG_ZERO, 'pow(-Inf, -1) = -0');
t('pow', [NEG_INF, -3], NEG_ZERO, 'pow(-Inf, -3) = -0');
// If base is -Inf and exponent < 0 and exponent is not odd integer, return +0.
t('pow', [NEG_INF, -2], POS_ZERO, 'pow(-Inf, -2) = +0');
t('pow', [NEG_INF, -4], POS_ZERO, 'pow(-Inf, -4) = +0');
t('pow', [NEG_INF, -0.5], POS_ZERO, 'pow(-Inf, -0.5) = +0');
// If base is +0 and exponent > 0, return +0.
t('pow', [POS_ZERO, 1], POS_ZERO, 'pow(+0, 1) = +0');
t('pow', [POS_ZERO, 2], POS_ZERO, 'pow(+0, 2) = +0');
// If base is +0 and exponent < 0, return +Inf.
t('pow', [POS_ZERO, -1], INF, 'pow(+0, -1) = +Inf');
t('pow', [POS_ZERO, -2], INF, 'pow(+0, -2) = +Inf');
// If base is -0 and exponent > 0 and exponent is odd integer, return -0.
t('pow', [NEG_ZERO, 1], NEG_ZERO, 'pow(-0, 1) = -0');
t('pow', [NEG_ZERO, 3], NEG_ZERO, 'pow(-0, 3) = -0');
// If base is -0 and exponent > 0 and exponent is not odd integer, return +0.
t('pow', [NEG_ZERO, 2], POS_ZERO, 'pow(-0, 2) = +0');
t('pow', [NEG_ZERO, 0.5], POS_ZERO, 'pow(-0, 0.5) = +0');
// If base is -0 and exponent < 0 and exponent is odd integer, return -Inf.
t('pow', [NEG_ZERO, -1], NEG_INF, 'pow(-0, -1) = -Inf');
t('pow', [NEG_ZERO, -3], NEG_INF, 'pow(-0, -3) = -Inf');
// If base is -0 and exponent < 0 and exponent is not odd integer, return +Inf.
t('pow', [NEG_ZERO, -2], INF, 'pow(-0, -2) = +Inf');
t('pow', [NEG_ZERO, -0.5], INF, 'pow(-0, -0.5) = +Inf');
// If base < 0 and base is finite and exponent is finite and not integer, return NaN.
t('pow', [-1, 0.5], NAN, 'pow(-1, 0.5) = NaN');
t('pow', [-2, 1.5], NAN, 'pow(-2, 1.5) = NaN');
// Exponent is NaN (and not +/-0).
t('pow', [1, NAN], NAN, 'pow(1, NaN) = NaN');
t('pow', [0.5, NAN], NAN, 'pow(0.5, NaN) = NaN');

// == Math.sin ==
// If x is NaN, return NaN.
t('sin', [NAN], NAN, 'sin(NaN) = NaN');
// If x is +0, return +0.
t('sin', [POS_ZERO], POS_ZERO, 'sin(+0) = +0');
// If x is -0, return -0.
t('sin', [NEG_ZERO], NEG_ZERO, 'sin(-0) = -0');
// If x is +Inf or -Inf, return NaN.
t('sin', [INF], NAN, 'sin(+Inf) = NaN');
t('sin', [NEG_INF], NAN, 'sin(-Inf) = NaN');

// == Math.sinh ==
// If x is NaN, return NaN.
t('sinh', [NAN], NAN, 'sinh(NaN) = NaN');
// If x is +0, return +0.
t('sinh', [POS_ZERO], POS_ZERO, 'sinh(+0) = +0');
// If x is -0, return -0.
t('sinh', [NEG_ZERO], NEG_ZERO, 'sinh(-0) = -0');
// If x is +Inf, return +Inf.
t('sinh', [INF], INF, 'sinh(+Inf) = +Inf');
// If x is -Inf, return -Inf.
t('sinh', [NEG_INF], NEG_INF, 'sinh(-Inf) = -Inf');

// == Math.sqrt ==
// If x is NaN, return NaN.
t('sqrt', [NAN], NAN, 'sqrt(NaN) = NaN');
// If x < 0, return NaN.
t('sqrt', [-1], NAN, 'sqrt(x < 0) = NaN');
t('sqrt', [NEG_INF], NAN, 'sqrt(-Inf) = NaN');
// If x is +0, return +0.
t('sqrt', [POS_ZERO], POS_ZERO, 'sqrt(+0) = +0');
// If x is -0, return -0.
t('sqrt', [NEG_ZERO], NEG_ZERO, 'sqrt(-0) = -0');
// If x is +Inf, return +Inf.
t('sqrt', [INF], INF, 'sqrt(+Inf) = +Inf');

// == Math.tan ==
// If x is NaN, return NaN.
t('tan', [NAN], NAN, 'tan(NaN) = NaN');
// If x is +0, return +0.
t('tan', [POS_ZERO], POS_ZERO, 'tan(+0) = +0');
// If x is -0, return -0.
t('tan', [NEG_ZERO], NEG_ZERO, 'tan(-0) = -0');
// If x is +Inf or -Inf, return NaN.
t('tan', [INF], NAN, 'tan(+Inf) = NaN');
t('tan', [NEG_INF], NAN, 'tan(-Inf) = NaN');

// == Math.tanh ==
// If x is NaN, return NaN.
t('tanh', [NAN], NAN, 'tanh(NaN) = NaN');
// If x is +0, return +0.
t('tanh', [POS_ZERO], POS_ZERO, 'tanh(+0) = +0');
// If x is -0, return -0.
t('tanh', [NEG_ZERO], NEG_ZERO, 'tanh(-0) = -0');
// If x is +Inf, return 1.
t('tanh', [INF], 1, 'tanh(+Inf) = 1');
// If x is -Inf, return -1.
t('tanh', [NEG_INF], -1, 'tanh(-Inf) = -1');

// --- Run tests ---

function runTests() {
  var results = [];
  for (var i = 0; i < tests.length; i++) {
    var tc = tests[i];
    var fn = Math[tc.fn];
    var got = fn.apply(null, tc.args);
    var pass = same(got, tc.expected);
    results.push({
      fn: tc.fn,
      args: tc.args.map(describe).join(', '),
      expected: describe(tc.expected),
      got: describe(got),
      pass: pass,
      desc: tc.desc,
    });
  }
  return results;
}

// --- CLI output ---

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests: runTests };
} else if (typeof window === 'undefined') {
  // Standalone JS engine (d8, jsc, etc.)
  var _log = typeof console !== 'undefined'
    ? function(s) { console.log(s); } : print;

  var results = runTests();
  var passed = 0, failed = 0;
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.pass) {
      passed++;
    } else {
      _log('FAIL: ' + r.desc + '  (got ' + r.got + ')');
      failed++;
    }
  }
  _log('\n' + passed + ' passed, ' + failed + ' failed, ' + results.length + ' total');
}
