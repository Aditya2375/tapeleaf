import { generate, snapshot } from "../web/src/model.js";
import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "node:fs";

const HTTP_PORT = 8983;
const CDP_PORT = 9384;
const SHOTS = process.env.SMOKE_SHOTS === "1";
const root = new URL("..", import.meta.url).pathname;

const profile = mkdtempSync("/tmp/tapeleaf-chrome-");
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    String(HTTP_PORT),
    "--bind",
    "127.0.0.1",
    "--directory",
    `${root}docs`,
  ],
  { stdio: "ignore", detached: true },
);
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

const cleanup = async (code) => {
  for (const child of [chrome, server]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    [chrome, server].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => child.once("exit", r)),
    ),
  );
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
const timeout = setTimeout(() => {
  console.error("smoke: timeout");
  cleanup(1);
}, 90000);
process.on("SIGINT", () => cleanup(2));
process.on("uncaughtException", (e) => {
  console.error(e);
  cleanup(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  cleanup(1);
});

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(
    `${ok ? "ok" : "NOT OK"} - ${name}${detail ? " - " + detail : ""}`,
  );
};

await waitFor(
  async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok,
  "chrome devtools",
);
const target = await (
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let mid = 0;
const rpcPending = new Map();
const consoleErrors = [];
const requests = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent")
    requests.push(msg.params.request.url);
  if (msg.id && rpcPending.has(msg.id)) {
    rpcPending.get(msg.id)(msg);
    rpcPending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown")
    consoleErrors.push(
      msg.params.exceptionDetails?.exception?.description ?? "page exception",
    );
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++mid;
    rpcPending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails)
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const shot = async (name) => {
  if (!SHOTS) return;
  await new Promise((r) => setTimeout(r, 900));
  const metrics = await cdp("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize;
  const r = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
  });
  writeFileSync(
    `${root}smoke-${name}.png`,
    Buffer.from(r.result.data, "base64"),
  );
};

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await waitFor(
  async () =>
    await evaluate(`document.querySelectorAll('#watchlist tr').length===6`),
  "rendered",
);
const input = (id, value) =>
  evaluate(
    `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true}));true`,
  );
const change = (id, value) =>
  evaluate(
    `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('change',{bubbles:true}));true`,
  );
const click = (id) =>
  evaluate(`document.getElementById(${JSON.stringify(id)}).click();true`);
const submit = () =>
  evaluate(`document.getElementById('generator').requestSubmit();true`);
const price = (x) => (x / 100).toFixed(2),
  signed = (x) => (x >= 0 ? "+" : "") + x.toFixed(3);
async function verify(seed, mode, j, c, w, label) {
  const a = generate(seed, mode),
    s = snapshot(a, j, c, w);
  check(
    label + "quoteBounds",
    await evaluate(
      `[...document.querySelectorAll('.quote div')].every(e=>{const a=e.querySelector('dt').getBoundingClientRect(),b=e.querySelector('dd').getBoundingClientRect(),r=e.getBoundingClientRect();return a.left>=r.left-1&&b.right<=r.right+1&&a.right<=innerWidth&&b.right<=innerWidth&&(a.bottom<=b.top+1||a.right<=b.left+1)})`,
    ),
  );
  const data = await evaluate(
    `({watch:[...document.querySelectorAll('#watchlist tr')].map(r=>[r.dataset.symbol,...[...r.cells].slice(1).map(x=>x.textContent)]),q:Object.fromEntries(['last','change','bid','ask','low','high','prior','vwap','volume'].map(k=>[k,document.getElementById('q-'+k).textContent])),bars:[...document.querySelectorAll('#bars tr')].map(r=>[...r.cells].map(t=>t.textContent)),trades:[...document.querySelectorAll('#trades tr')].map(r=>[...r.cells].map(t=>t.textContent)),box:document.getElementById('chart').getBoundingClientRect().width,marks:[...document.querySelectorAll('#chart [data-kind]')].map(x=>({kind:x.dataset.kind,start:x.dataset.start,attrs:Object.fromEntries([...x.attributes].map(a=>[a.name,a.value]))})),state:document.getElementById('bar-status').textContent})`,
  );
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check(
    label + "headline",
    eq(data.q, {
      last: price(s.last),
      change: signed(s.change),
      bid: price(s.bid),
      ask: price(s.ask),
      low: price(s.low),
      high: price(s.high),
      prior: price(s.prior),
      vwap: (s.vwap / 100).toFixed(4) + " u",
      volume: s.volume + " shares",
    }),
  );
  check(
    label + "watch",
    data.watch.every(([name, last, change]) => {
      const k = ["ALFA", "BRIO", "COVE", "DUNE", "ELIO", "FENN"].indexOf(name),
        x = snapshot(a, k, c, w);
      return last === price(x.last) && change === signed(x.change);
    }),
  );
  check(
    label + "allbars",
    eq(
      data.bars,
      s.bars.map((b) => [
        `${b.start}-${b.end}`,
        price(b.open),
        price(b.high),
        price(b.low),
        price(b.close),
        String(b.volume),
        b.complete ? "Complete" : "Partial",
      ]),
    ),
  );
  check(
    label + "recent10",
    eq(
      data.trades,
      s.trades.map((t) => [String(t.tick), price(t.price), String(t.size)]),
    ),
  );
  const W = Math.max(200, Math.floor(data.box)),
    H = W < 500 ? 280 : 300,
    L = 53,
    R = 12,
    T = 22,
    B = 40,
    iw = W - L - R,
    ih = H - T - B,
    pad = Math.max(10, (s.high - s.low) * 0.12),
    lo = s.low - pad,
    hi = s.high + pad,
    x = (t) => L + ((t - 0.5) / 120) * iw,
    y = (p) => T + ((hi - p) / (hi - lo)) * ih;
  const near = (a, b) => Math.abs(Number(a) - b) < 1e-8;
  let ok = true;
  const wicks = data.marks.filter((x) => x.kind === "wick"),
    bodies = data.marks.filter((x) => x.kind === "body");
  ok &&= wicks.length === s.bars.length && bodies.length === s.bars.length;
  s.bars.forEach((b, i) => {
    const xx = x((b.start + b.end) / 2),
      bw = Math.max(2, ((b.end - b.start + 1) / 120) * iw * 0.58),
      v = wicks[i]?.attrs,
      z = bodies[i]?.attrs;
    ok &&=
      !!v &&
      near(v.x1, xx) &&
      near(v.y1, y(b.high)) &&
      near(v.y2, y(b.low)) &&
      !!z &&
      near(z.x, xx - bw / 2) &&
      near(z.y, Math.min(y(b.open), y(b.close))) &&
      near(z.width, bw) &&
      near(z.height, Math.max(1, Math.abs(y(b.open) - y(b.close)))) &&
      z.fill ===
        (b.complete ? (b.close >= b.open ? "#b4d68a" : "#f8aaa1") : "none");
  });
  check(label + "allOHLCpixels", ok);
  const path = data.marks.find((x) => x.kind === "vwap").attrs.d,
    vals = [...path.matchAll(/[ML]([^ ]+) ([^ML]+)/g)].map((m) => [
      +m[1],
      +m[2],
    ]);
  check(
    label + "VWAPallpoints",
    vals.length === c &&
      vals.every(
        (v, i) => near(v[0], x(i + 1)) && near(v[1], y(s.vwapPath[i])),
      ),
  );
  check(
    label + "partiallabel",
    data.state.includes(s.bars.at(-1).complete ? "is complete" : "is partial"),
  );
}
await verify(2026, "mixed", 0, 30, 10, "default");
await shot("default");
await click("first");
await verify(2026, "mixed", 0, 1, 10, "first");
check(
  "firstDisabled",
  await evaluate(
    `document.getElementById('first').disabled&&document.getElementById('prev').disabled&&document.querySelector('#chart [data-kind=single-vwap]')!==null`,
  ),
);
await shot("first");
await input("seed", "4294967295");
await input("cursor", 11);
await verify(2026, "mixed", 0, 11, 10, "dirtyCursorUsesApplied");
await submit();
await change("width", 5);
await click("last");
await verify(4294967295, "mixed", 0, 120, 5, "lastBoundary");
check(
  "lastDisabled",
  await evaluate(
    `document.getElementById('next').disabled&&document.getElementById('jump').disabled&&document.getElementById('last').disabled`,
  ),
);
await evaluate(
  `document.querySelector('[data-symbol="FENN"] button').click();true`,
);
await change("sort", "change");
check(
  "selectionFocusPreserved",
  await evaluate(
    `document.activeElement.getAttribute('aria-label')==='Inspect FENN'&&document.querySelector('button[aria-pressed=true]').textContent==='FENN'`,
  ),
);
await verify(4294967295, "mixed", 5, 120, 5, "selectedFenn");
check(
  "sortDescending",
  await evaluate(
    `(()=>{const v=[...document.querySelectorAll('#watchlist tr')].map(r=>Number(r.cells[2].textContent));return v.every((x,i)=>!i||v[i-1]>=x)})()`,
  ),
);
await change("sort", "spread");
check(
  "spreadSortDescending",
  await evaluate(
    `(()=>{const a=[...document.querySelectorAll("#watchlist tr")].map(r=>r.dataset.symbol);return a.join()===${JSON.stringify(
      [0, 1, 2, 3, 4, 5]
        .sort(
          (a, b) =>
            snapshot(generate(4294967295, "mixed"), b, 120, 5).spreadBps -
              snapshot(generate(4294967295, "mixed"), a, 120, 5).spreadBps ||
            a - b,
        )
        .map((j) => ["ALFA", "BRIO", "COVE", "DUNE", "ELIO", "FENN"][j])
        .join(),
    )}})()`,
  ),
);
await input("seed", "0");
const before = await evaluate(`document.getElementById('q-last').textContent`);
await submit();
check(
  "invalidRetains",
  before ===
    (await evaluate(`document.getElementById('q-last').textContent`)) &&
    (await evaluate(`document.getElementById('status').className==='error'`)),
);
await input("seed", "1");
await change("scenario", "quiet");
await submit();
await verify(1, "quiet", 5, 30, 5, "flat");
await shot("flat");
await input("seed", "2026");
await change("scenario", "trend");
await submit();
await input("cursor", 59);
await change("width", 20);
await verify(2026, "trend", 5, 59, 20, "trendPartial");
await shot("trend");
for (const w of [320, 360, 390, 768]) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 90));
  check(
    w + "page",
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
  );
  check(
    w + "chart",
    await evaluate(
      `(()=>{const r=document.getElementById('chart').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&Number(document.getElementById('chart').getAttribute('viewBox').split(' ')[2])<=r.width+1})()`,
    ),
  );
  check(
    w + "quoteBounds",
    await evaluate(
      `[...document.querySelectorAll('.quote div')].every(e=>{const a=e.querySelector('dt').getBoundingClientRect(),b=e.querySelector('dd').getBoundingClientRect(),r=e.getBoundingClientRect();return a.left>=r.left-1&&b.right<=r.right+1&&a.right<=innerWidth&&b.right<=innerWidth&&(a.bottom<=b.top+1||a.right<=b.left+1)})`,
    ),
  );
  await shot("mobile-" + w);
}
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((r) => setTimeout(r, 90));
await evaluate(`document.querySelector('details').open=true;true`);
check(
  "320expanded",
  await evaluate(
    `document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.ledger').scrollWidth>document.querySelector('.ledger').clientWidth`,
  ),
);
check(
  "mobileTapeVisible",
  await evaluate(
    `document.getElementById('trades').getBoundingClientRect().height>0`,
  ),
);
await shot("mobile-expanded");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((r) => setTimeout(r, 90));
await shot("details");
check(
  "CSPconnectnone",
  await evaluate(
    `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'")`,
  ),
);
check(
  "nostorage",
  await evaluate(`localStorage.length===0&&sessionStorage.length===0`),
);
check("noexceptions", consoleErrors.length === 0, consoleErrors.join(";"));
const unexpected = requests.filter(
  (u) =>
    !u.startsWith(`http://127.0.0.1:${HTTP_PORT}/`) &&
    u !== "about:blank" &&
    !u.startsWith("data:"),
);
check("noofforigin", unexpected.length === 0, unexpected.join(";"));
writeFileSync(
  `${root}build/browser-result.json`,
  JSON.stringify(checks, null, 2),
);
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length} browser checks, ${failed.length} failed`);
clearTimeout(timeout);
ws.close();
await cleanup(failed.length ? 1 : 0);
