export const SYMBOLS = ["ALFA", "BRIO", "COVE", "DUNE", "ELIO", "FENN"];
export const BASE = [4800, 7300, 12500, 3200, 9100, 15600];
export const TICKS = 120;
export const nextPrice = (prior, step) => Math.max(100, prior + step);
export function generate(seed, scenario) {
  if (
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 4294967295 ||
    !["mixed", "trend", "quiet"].includes(scenario)
  )
    throw Error("Invalid generation inputs");
  let x = seed >>> 0;
  const next = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
  const all = SYMBOLS.map(() => []),
    p = [...BASE];
  for (let tick = 1; tick <= TICKS; tick++)
    for (let j = 0; j < 6; j++) {
      const raw = (next() % 41) - 20;
      p[j] = nextPrice(
        p[j],
        scenario === "quiet"
          ? 0
          : raw + (scenario === "trend" ? (j % 2 === 0 ? 9 : -9) : 0),
      );
      const half = 1 + (next() % 8),
        size = 10 * (1 + (next() % 100));
      all[j].push({
        tick,
        price: p[j],
        size,
        bid: p[j] - half,
        ask: p[j] + half,
      });
    }
  return all;
}
export function snapshot(all, symbol, cursor, width) {
  if (
    !Array.isArray(all) ||
    all.length !== 6 ||
    !Number.isInteger(symbol) ||
    symbol < 0 ||
    symbol >= 6 ||
    !Number.isInteger(cursor) ||
    cursor < 1 ||
    cursor > TICKS ||
    ![5, 10, 20].includes(width)
  )
    throw Error("Invalid snapshot inputs");
  const ticks = all[symbol];
  if (ticks.length !== TICKS) throw Error("Invalid tape");
  let volume = 0,
    notional = 0,
    high = -Infinity,
    low = Infinity;
  const vwapPath = [],
    bars = [];
  for (let i = 0; i < cursor; i++) {
    const t = ticks[i];
    volume += t.size;
    notional += t.price * t.size;
    high = Math.max(high, t.price);
    low = Math.min(low, t.price);
    vwapPath.push(notional / volume);
  }
  for (let i = 0; i < cursor; i += width) {
    const end = Math.min(cursor, i + width);
    let h = -Infinity,
      l = Infinity,
      v = 0;
    for (let k = i; k < end; k++) {
      const t = ticks[k];
      h = Math.max(h, t.price);
      l = Math.min(l, t.price);
      v += t.size;
    }
    bars.push({
      start: i + 1,
      end,
      open: ticks[i].price,
      high: h,
      low: l,
      close: ticks[end - 1].price,
      volume: v,
      complete: end - i === width,
    });
  }
  const t = ticks[cursor - 1];
  return {
    prior: BASE[symbol],
    last: t.price,
    bid: t.bid,
    ask: t.ask,
    high,
    low,
    volume,
    notional,
    vwap: notional / volume,
    change: (100 * (t.price - BASE[symbol])) / BASE[symbol],
    spreadBps: (10000 * (t.ask - t.bid)) / ((t.ask + t.bid) / 2),
    vwapPath,
    bars,
    trades: ticks.slice(Math.max(0, cursor - 10), cursor).reverse(),
  };
}
