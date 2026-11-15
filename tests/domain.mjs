import assert from "node:assert/strict";
import { generate, snapshot, nextPrice } from "../web/src/model.js";
let n = 0;
const ck = (x) => {
  assert(x);
  n++;
};
for (const mode of ["mixed", "trend", "quiet"])
  for (const seed of [1, 2026, 4294967295]) {
    const a = generate(seed, mode);
    for (let j = 0; j < 6; j++)
      for (let c = 1; c <= 120; c++) {
        const s = snapshot(a, j, c, 10);
        const b = structuredClone(a);
        for (let k = c; k < 120; k++)
          b[j][k] = { tick: k + 1, price: 1, size: 1, bid: 0, ask: 2 };
        ck(JSON.stringify(s) === JSON.stringify(snapshot(b, j, c, 10)));
        const x = snapshot(a, j, c, 5),
          y = snapshot(a, j, c, 20);
        for (const k of [
          "last",
          "bid",
          "ask",
          "high",
          "low",
          "volume",
          "notional",
          "vwap",
          "change",
          "spreadBps",
        ])
          ck(x[k] === y[k]);
        const prices = a[j].slice(0, c).map((t) => t.price);
        ck(s.high === Math.max(...prices) && s.low === Math.min(...prices));
        ck(s.volume === s.bars.reduce((v, b) => v + b.volume, 0));
        ck(s.trades.every((t) => t.tick <= c));
        ck(s.bars.every((t) => t.end <= c));
        ck(s.vwapPath.length === c);
      }
  }
for (const seed of [0, -1, 1.2, NaN, Infinity, 4294967296])
  assert.throws(() => generate(seed, "mixed"));
for (const v of [
  [0, 0, 5],
  [0, 121, 5],
  [6, 1, 5],
  [0, 1.5, 5],
  [0, 1, 15],
])
  assert.throws(() => snapshot(generate(1, "mixed"), ...v));

for (const [p, d, e] of [
  [100, -29, 100],
  [101, -1, 100],
  [100, 1, 101],
  [129, -29, 100],
])
  ck(nextPrice(p, d) === e);

const fixture = generate(1, "quiet");
fixture[0].splice(
  0,
  3,
  { tick: 1, price: 100, size: 1, bid: 99, ask: 101 },
  { tick: 2, price: 300, size: 2, bid: 299, ask: 301 },
  { tick: 3, price: 200, size: 3, bid: 199, ask: 201 },
);
const f = snapshot(fixture, 0, 3, 5);
ck(f.vwap === 1300 / 6);
ck(f.volume === 6 && f.notional === 1300);
ck(
  f.bars[0].open === 100 &&
    f.bars[0].high === 300 &&
    f.bars[0].low === 100 &&
    f.bars[0].close === 200 &&
    !f.bars[0].complete,
);
ck(f.spreadBps === 100);
console.log(
  `${n} prefix/no-lookahead/aggregation/domain/analytic checks passed`,
);
