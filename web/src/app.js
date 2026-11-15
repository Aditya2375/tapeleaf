import { SYMBOLS, generate, snapshot } from "./model.js";
const $ = (id) => document.getElementById(id);
let seed = 2026,
  scenario = "mixed",
  all = generate(seed, scenario),
  cursor = 30,
  symbol = 0,
  width = 10;
const price = (x) => (x / 100).toFixed(2),
  signed = (x) => (x >= 0 ? "+" : "") + x.toFixed(3),
  num = (x) => String(x);
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
function row(body, values) {
  const tr = el("tr");
  for (const v of values) tr.append(el("td", v));
  body.append(tr);
  return tr;
}
function status(text, error = false) {
  $("status").textContent = text;
  $("status").className = error ? "error" : "";
}
function render(announce = true) {
  const focused = document.activeElement
    ?.closest("#watchlist button")
    ?.getAttribute("aria-label");
  const snaps = SYMBOLS.map((_, j) => snapshot(all, j, cursor, width)),
    s = snaps[symbol];
  $("cursor").value = cursor;
  $("progress").textContent =
    `TICK ${cursor} / 120 · ${cursor === 120 ? "SESSION REVEALED" : "PAUSED"}`;
  for (const id of ["first", "prev"]) $(id).disabled = cursor === 1;
  for (const id of ["next", "jump", "last"]) $(id).disabled = cursor === 120;
  $("breadth").textContent =
    `${snaps.filter((x) => x.change > 0).length} up / ${snaps.filter((x) => x.change < 0).length} down / ${snaps.filter((x) => x.change === 0).length} unchanged · versus invented prior closes`;
  const order = [0, 1, 2, 3, 4, 5];
  if ($("sort").value !== "symbol") {
    const key = $("sort").value === "change" ? "change" : "spreadBps";
    order.sort((a, b) => snaps[b][key] - snaps[a][key] || a - b);
  }
  $("watchlist").replaceChildren();
  for (const j of order) {
    const x = snaps[j],
      tr = el("tr", undefined, j === symbol ? "selected" : "");
    tr.dataset.symbol = SYMBOLS[j];
    const td = el("td"),
      b = el("button", SYMBOLS[j]);
    b.type = "button";
    b.setAttribute("aria-pressed", String(j === symbol));
    b.setAttribute("aria-label", `Inspect ${SYMBOLS[j]}`);
    b.addEventListener("click", () => {
      symbol = j;
      render();
      $("watchlist")
        .querySelector(`[data-symbol="${SYMBOLS[j]}"] button`)
        .focus();
    });
    td.append(b);
    tr.append(
      td,
      el("td", price(x.last)),
      el(
        "td",
        signed(x.change),
        x.change > 0 ? "up" : x.change < 0 ? "down" : "",
      ),
    );
    $("watchlist").append(tr);
  }
  $("symbol-title").textContent = `03 / ${SYMBOLS[symbol]}`;
  $("instrument-note").textContent =
    `Fictional instrument · applied seed ${seed} · ${scenario} · all prices in fictitious units (u)`;
  for (const [k, v] of Object.entries({
    last: price(s.last),
    change: signed(s.change),
    bid: price(s.bid),
    ask: price(s.ask),
    spread: `${price(s.ask - s.bid)} u / ${s.spreadBps.toFixed(2)} bps`,
    vwap: `${(s.vwap / 100).toFixed(4)} u`,
    volume: `${s.volume} shares`,
    low: price(s.low),
    high: price(s.high),
    prior: price(s.prior),
  }))
    $("q-" + k).textContent = v;
  $("q-change").className = s.change > 0 ? "up" : s.change < 0 ? "down" : "";
  $("trades").replaceChildren();
  for (const t of s.trades)
    row($("trades"), [num(t.tick), price(t.price), num(t.size)]);
  $("tape-label").textContent =
    `${SYMBOLS[symbol]} · ticks ${Math.max(1, cursor - 9)}-${cursor} · newest first`;
  $("bars").replaceChildren();
  for (const b of s.bars)
    row($("bars"), [
      `${b.start}-${b.end}`,
      price(b.open),
      price(b.high),
      price(b.low),
      price(b.close),
      num(b.volume),
      b.complete ? "Complete" : "Partial",
    ]);
  const last = s.bars.at(-1);
  $("bar-status").textContent =
    `Bar ${last.start}-${last.end} is ${last.complete ? "complete" : `partial (${last.end - last.start + 1}/${width} ticks)`}. No trades after tick ${cursor} enter this view.`;
  $("chart-caption").textContent =
    `${width}-tick OHLC bars · ${s.bars.length} visible · VWAP from tick 1`;
  draw(s);
  if (focused) {
    const b = [...$("watchlist").querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === focused,
    );
    b?.focus();
  }
  if (announce)
    status(
      `Applied seed ${seed} / ${scenario}. ${SYMBOLS[symbol]}, visible ticks 1-${cursor}. No live feed.`,
    );
}
function draw(s) {
  const svg = $("chart"),
    W = Math.max(200, Math.floor(svg.getBoundingClientRect().width)),
    H = W < 500 ? 280 : 300,
    L = 53,
    R = 12,
    T = 22,
    B = 40,
    iw = W - L - R,
    ih = H - T - B;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const put = (tag, attrs, text) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    svg.append(e);
    return e;
  };
  put(
    "title",
    {},
    `${SYMBOLS[symbol]} OHLC bars through tick ${cursor}, with cumulative trade VWAP. Exact OHLCV values below.`,
  );
  const pad = Math.max(10, (s.high - s.low) * 0.12),
    lo = s.low - pad,
    hi = s.high + pad,
    x = (t) => L + ((t - 0.5) / 120) * iw,
    y = (p) => T + ((hi - p) / (hi - lo)) * ih;
  // Fixed full-session x scale makes the unseen future visibly empty rather than silently compressed.
  for (const frac of [0, 0.5, 1]) {
    const yy = T + frac * ih;
    put("line", { x1: L, y1: yy, x2: W - R, y2: yy, stroke: "#34434b" });
    put(
      "text",
      {
        x: L - 7,
        y: yy + 4,
        "text-anchor": "end",
        fill: "#a8b6bf",
        "font-size": 10,
        "font-family": "monospace",
      },
      price(hi - frac * (hi - lo)),
    );
  }
  for (const t of [1, 60, 120])
    put(
      "text",
      {
        x: x(t),
        y: H - 19,
        "text-anchor": t === 1 ? "start" : t === 120 ? "end" : "middle",
        fill: "#a8b6bf",
        "font-size": 10,
        "font-family": "monospace",
      },
      String(t),
    );
  put(
    "text",
    {
      x: W - R,
      y: H - 2,
      "text-anchor": "end",
      fill: "#a8b6bf",
      "font-size": 10,
      "font-family": "monospace",
    },
    "Event tick",
  );
  const reveal = L + (cursor / 120) * iw;
  put("line", {
    x1: reveal,
    x2: reveal,
    y1: T,
    y2: T + ih,
    stroke: "#71838e",
    "stroke-dasharray": "3 4",
    "data-kind": "cursor",
  });
  if (cursor < 100)
    put(
      "text",
      {
        x: Math.min(W - R - 3, reveal + 8),
        y: T + 15,
        fill: "#a8b6bf",
        "font-size": 10,
        "font-family": "monospace",
      },
      "unseen →",
    );
  for (const b of s.bars) {
    const xx = x((b.start + b.end) / 2),
      bw = Math.max(2, ((b.end - b.start + 1) / 120) * iw * 0.58),
      color = b.close >= b.open ? "#b4d68a" : "#f8aaa1";
    put("line", {
      x1: xx,
      x2: xx,
      y1: y(b.high),
      y2: y(b.low),
      stroke: color,
      "stroke-width": 1.5,
      "data-kind": "wick",
      "data-start": b.start,
    });
    put("rect", {
      x: xx - bw / 2,
      y: Math.min(y(b.open), y(b.close)),
      width: bw,
      height: Math.max(1, Math.abs(y(b.open) - y(b.close))),
      fill: b.complete ? color : "none",
      stroke: color,
      "stroke-width": 1.5,
      "data-kind": "body",
      "data-start": b.start,
    });
  }
  put("path", {
    d: s.vwapPath
      .map((p, i) => `${i ? "L" : "M"}${x(i + 1)} ${y(p)}`)
      .join(" "),
    fill: "none",
    stroke: "#7cd9ea",
    "stroke-width": 1.8,
    "data-kind": "vwap",
  });
  if (cursor === 1)
    put("circle", {
      cx: x(1),
      cy: y(s.vwap),
      r: 2.5,
      fill: "#7cd9ea",
      "data-kind": "single-vwap",
    });
}
$("generator").addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = $("seed").value.trim(),
    v = Number(raw);
  if (!raw || !Number.isInteger(v) || v < 1 || v > 4294967295) {
    status(
      "Use a whole seed from 1 to 4,294,967,295. The applied session is unchanged.",
      true,
    );
    return;
  }
  try {
    const mode = $("scenario").value,
      newTape = generate(v, mode);
    seed = v;
    scenario = mode;
    all = newTape;
    cursor = 30;
    render();
  } catch {
    status("Invalid inputs. The applied session is unchanged.", true);
  }
});
$("generator").addEventListener(
  "invalid",
  () => status("Invalid seed. The applied session is unchanged.", true),
  true,
);
for (const id of ["seed", "scenario"])
  $(id).addEventListener("input", () =>
    status(
      "Inputs changed, not applied. Generate session to reset and use them.",
    ),
  );
$("cursor").addEventListener("input", () => {
  cursor = Number($("cursor").value);
  render();
});
for (const [id, f] of Object.entries({
  first: () => 1,
  prev: () => cursor - 1,
  next: () => cursor + 1,
  jump: () => cursor + 10,
  last: () => 120,
}))
  $(id).addEventListener("click", () => {
    cursor = Math.min(120, Math.max(1, f()));
    render();
  });
$("sort").addEventListener("change", () => render());
$("width").addEventListener("change", () => {
  width = Number($("width").value);
  render();
});
new ResizeObserver(() => draw(snapshot(all, symbol, cursor, width))).observe(
  $("chart"),
);
render();
