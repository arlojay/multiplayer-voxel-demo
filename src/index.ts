import './style.css';

const input = <HTMLInputElement>document.getElementById('n');
const result = <HTMLInputElement>document.getElementById('result');

document.getElementById('compute').addEventListener('click', () => {
  let n = input.valueAsNumber;
  if (isNaN(n) || n < 0) {
    n = 0;
  }
  n = ~~n;

  const fn: number = fib_non_recursive(n);
  result.value = fn.toString();
});

function fib_crash(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 1;
  return fib_crash(n - 1) + fib_crash(n - 2);
}

function fib_dp(n: number): number {
  const f: number[] = [0, 1];
  for (let i = 2; i < n; i++) {
    f.push(f[i - 1] + f[i - 2]);
  }
  return f[n];
}

const f: number[] = [0, 1];
function fib_dp_g(n: number): number {
  if (n < f.length) return f[n];
  for (let i = f.length; i < n; i++) {
    f.push(f[i - 1] + f[i - 2]);
  }
  return f[n];
}

function fib_memo(n: number, memo: Map<number, number> = new Map()): number {
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (memo.has(n)) return memo.get(n);
  const fn = fib_memo(n - 1, memo) + fib_memo(n - 2, memo);
  memo.set(n, fn);
  return fn;
}

const cache: Map<number, number> = new Map();
cache.set(0, 0).set(1, 1);
function fib_memo_g(n: number): number {
  if (cache.has(n)) return cache.get(n);
  const fn = fib_memo_g(n - 1) + fib_memo_g(n - 2);
  cache.set(n, fn);
  return fn;
}

const fib = trampoline(_fib);

function _fib(n: number, sum = 0, prev = 1): Function {
  return () => (n === 0 ? sum : fib(n - 1, prev + sum, sum));
}

function trampoline(fn: Function): Function {
  return (...args: any[]) => {
    let result = fn(...args);
    while (result && result instanceof Function) {
      result = result();
    }
    return result;
  };
}

function fib_non_recursive(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 1;
  let f1 = 0,
    f2 = 1;
  for (let i = 1; i < n; i++) {
    [f1, f2] = [f2, f1 + f2];
  }
  return f2;
}

const a = fib(1500);
const b = _fib(1500)();
console.log(Number.POSITIVE_INFINITY === a);
console.log(b);
console.log(fib(1476));
console.log(fib_memo(1479));
// console.log(fib_crash(100));
console.log(fib_non_recursive(2));
console.log(fib(2));
console.log(fib_non_recursive(12));
console.log(fib(12));
