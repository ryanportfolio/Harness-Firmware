#!/usr/bin/env node
// ab.mjs — interleaved A/B of two URLs, with the statistics needed to tell a
// real change from run-to-run noise. Zero npm deps.
//
//   node ab.mjs --a http://127.0.0.1:5301/ --b http://127.0.0.1:5302/ --runs 10
//   node ab.mjs --a ... --b ... --runs 12 --profile desktop --labels before,after
//
// Two design choices that are the whole point of this file:
//
// 1. INTERLEAVED, not batched. Runs alternate A,B,A,B... so a machine that gets
//    busier (or a network that degrades) partway through hits both arms equally
//    instead of loading all the harm onto whichever arm ran second.
//
// 2. DISTRIBUTIONS, not means. LCP in particular is frequently bimodal: a
//    resource either makes a round trip or it doesn't. A mean smears the two
//    modes into a number that describes neither, and a median at n=5 can land
//    in either mode by luck. Report p25/median/p75 and look at the spread. If
//    the interquartile ranges of the two arms overlap, you do not have a result.
//
// Default n=10 is a floor, not a target. n=5 flipped the verdict twice in the
// session this was distilled from.
import { probe, summarize } from './probe.mjs';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const a = arg('a'); const b = arg('b');
if (!a || !b || a === true || b === true) {
  console.error('usage: node ab.mjs --a <urlA> --b <urlB> [--runs 10] [--profile mobile|desktop] [--labels before,after]');
  process.exit(1);
}
const runs = Number(arg('runs', 10));
const profile = String(arg('profile', 'mobile'));
const settleMs = Number(arg('settle', 9000));
const [labelA, labelB] = String(arg('labels', 'A,B')).split(',');

const METRICS = [
  ['fcpMs', 'FCP', 'lower'],
  ['lcpMs', 'LCP', 'lower'],
  ['tbtMs', 'TBT', 'lower'],
  ['clsX1000', 'CLS*1e3', 'lower'],
  ['domContentLoadedMs', 'DCL', 'lower'],
];

const pad = (s, n) => String(s).padStart(n);
const results = { a: [], b: [] };

console.log(`\n${labelA}: ${a}\n${labelB}: ${b}\nprofile ${profile}, ${runs} interleaved runs per arm\n`);
if (runs < 6) {
  // At small n the quartiles collapse onto the few samples there are, so two
  // arms of the SAME build will show non-overlapping ranges and the verdict
  // column will confidently invent a winner. Verified: at n=2, two byte-identical
  // builds produced "after better, -588ms LCP".
  console.log(`!! n=${runs} is too few for the overlap test to mean anything. Quartiles collapse onto`);
  console.log('   individual samples and identical builds will read as a clear winner. Use --runs 10+');
  console.log('   for any result you intend to act on; treat this run as a smoke test.\n');
}

for (let i = 0; i < runs; i++) {
  process.stderr.write(`  round ${i + 1}/${runs}\r`);
  results.a.push(await probe({ url: String(a), profile, settleMs }));
  results.b.push(await probe({ url: String(b), profile, settleMs }));
}
process.stderr.write('\n');

const vals = (arm, key) => results[arm]
  .map((r) => (key === 'clsX1000' ? Math.round(r.metrics.cls * 1000) : r.metrics[key]))
  .filter((v) => typeof v === 'number');

// Protocol mismatch between arms invalidates the comparison outright, and it is
// invisible in the metric table, so it gets checked before anything is printed.
const protoOf = (arm) => Object.keys(results[arm][0].protocols).filter((p) => p !== 'data').sort().join('+');
if (protoOf('a') !== protoOf('b')) {
  console.log(`!! TRANSPORT MISMATCH: ${labelA} served over ${protoOf('a')}, ${labelB} over ${protoOf('b')}.`);
  console.log('   These numbers are not comparable. Serve both arms the same way and re-run.\n');
}

console.log('Timing (ms) - median on the first line, p25..p75 spread underneath');
console.log('  ' + 'metric'.padEnd(10) + pad(labelA, 12) + pad(labelB, 12) + pad('delta', 9) + '   verdict');
for (const [key, label] of METRICS) {
  const A = vals('a', key); const B = vals('b', key);
  if (!A.length || !B.length) continue;
  const sa = summarize(A); const sb = summarize(B);
  const delta = sb.median - sa.median;
  // An honest verdict needs the spreads to separate. Overlapping interquartile
  // ranges mean the medians differ by luck as easily as by cause.
  const overlap = sa.p25 <= sb.p75 && sb.p25 <= sa.p75;
  const verdict = overlap ? 'noise (IQRs overlap)' : (delta < 0 ? `${labelB} better` : `${labelB} worse`);
  console.log('  ' + label.padEnd(10) + pad(sa.median, 12) + pad(sb.median, 12) + pad((delta > 0 ? '+' : '') + delta, 9) + '   ' + verdict);
  console.log('  ' + ''.padEnd(10) + pad(`${sa.p25}..${sa.p75}`, 12) + pad(`${sb.p25}..${sb.p75}`, 12));
}

// These are deterministic properties of the build, not samples. They deserve to
// be stated with confidence the timings have not earned.
console.log('\nDeterministic (build properties, not measurements)');
const lastA = results.a[results.a.length - 1]; const lastB = results.b[results.b.length - 1];
const rows = [
  ['requests', lastA.totals.requests, lastB.totals.requests],
  ['wire KB', lastA.totals.kb, lastB.totals.kb],
  ['unused JS KB', lastA.unusedJsTotalKb, lastB.unusedJsTotalKb],
  ['request waves', lastA.waves.length, lastB.waves.length],
];
console.log('  ' + 'metric'.padEnd(16) + pad(labelA, 12) + pad(labelB, 12) + pad('delta', 9));
for (const [label, x, y] of rows) {
  console.log('  ' + label.padEnd(16) + pad(x, 12) + pad(y, 12) + pad((y - x > 0 ? '+' : '') + (y - x), 9));
}

const lcpA = summarize(vals('a', 'lcpMs'));
const lcpB = summarize(vals('b', 'lcpMs'));
const fcpA = summarize(vals('a', 'fcpMs'));
const fcpB = summarize(vals('b', 'fcpMs'));
console.log('\nRead this before calling it a win:');
console.log(`  LCP element ${labelA}: ${lastA.metrics.lcpElement}`);
console.log(`  LCP element ${labelB}: ${lastB.metrics.lcpElement}`);
if (lastA.metrics.lcpElement !== lastB.metrics.lcpElement) {
  console.log('  ^ different LCP elements: the arms are not measuring the same thing.');
}
if (fcpB.median > fcpA.median && lcpB.median < lcpA.median) {
  console.log(`  ${labelB} trades FCP (+${fcpB.median - fcpA.median}ms) for LCP (${lcpB.median - lcpA.median}ms).`);
  console.log('  That is a real tradeoff, not a free win. Lighthouse weights LCP 25% and FCP 10%,');
  console.log('  but a slower first paint is felt, so decide deliberately rather than by score.');
}
if (lastB.failedRequests.length || lastA.failedRequests.length) {
  console.log(`  failed requests: ${labelA}=${lastA.failedRequests.length} ${labelB}=${lastB.failedRequests.length} - fix before trusting anything above.`);
}
