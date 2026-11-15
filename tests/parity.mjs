import { generate, snapshot } from "../web/src/model.js";
import { execFileSync } from "node:child_process";
let n = 0,
  max = 0;
function same(a, b) {
  if (typeof a === "number") {
    n++;
    const d = Math.abs(a - b);
    max = Math.max(max, d);
    if (d > 1e-12 * Math.max(1, Math.abs(a))) throw Error(`${a} vs ${b}`);
  } else if (Array.isArray(a)) {
    if (a.length !== b.length) throw Error("length");
    a.forEach((v, i) => same(v, b[i]));
  } else if (a && typeof a === "object") {
    if (Object.keys(a).join() != Object.keys(b).join()) throw Error("keys");
    Object.keys(a).forEach((k) => same(a[k], b[k]));
  } else {
    n++;
    if (a !== b) throw Error("value");
  }
}
for (const seed of [1, 2, 2026, 2147483648, 4294967295])
  for (const mode of ["mixed", "trend", "quiet"]) {
    const a = generate(seed, mode),
      out = [a];
    for (let j = 0; j < 6; j++)
      for (const c of [1, 5, 6, 10, 11, 59, 60, 119, 120])
        for (const w of [5, 10, 20]) out.push(snapshot(a, j, c, w));
    same(
      out,
      JSON.parse(
        execFileSync(
          process.env.JAVA || "java",
          ["-cp", "build/classes", "Dump", String(seed), mode],
          { maxBuffer: 64e6, encoding: "utf8" },
        ),
      ),
    );
  }
console.log(`${n} full Java/JS values, max difference ${max}`);
