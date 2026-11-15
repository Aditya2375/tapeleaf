# Tape and accounting specification

## Domain and generator

Six fictitious labels in fixed order: ALFA, BRIO, COVE, DUNE, ELIO, FENN. Invented prior closes in cents: 4800, 7300, 12500, 3200, 9100, 15600. A price unit is 100 cents here, with no claim about any actual currency or venue. Every event t=1..120 produces exactly one trade and one quote for every symbol, in symbol order. The event index is not elapsed time.

Seed is an integer 1..2^32-1. xorshift32 uses the unsigned 32-bit recurrence x ^= x<<13; x ^= x>>>17; x ^= x<<5, masking to 32 bits after operations. Java uses a masked long; JavaScript uses unsigned conversion. For every event and symbol consume three outputs, even in flat mode:

1. raw = output % 41 - 20. Mixed step = raw. Alternating drift adds +9 cents for even-index symbols, -9 for odd. Flat step = 0. New trade price = max(100 cents, previous trade price + step), starting from invented prior close.
2. half-spread h = 1 + output % 8 cents. Bid = current trade price - h, ask = current trade price + h.
3. trade size = 10 × (1 + output % 100), or 10..1000 invented shares.

A floor of 100 cents (1 fictitious unit) is applied to each new price. This guarantees positive trade prices and quotes, since the half-spread never exceeds 8 cents. The floor clips negative steps near the boundary, so a drift is an input step bias, not a guaranteed expected return. No ceiling is needed: maximum price is bounded by the largest prior close plus 120×29 cents. This is an artificial safety bound, not an exchange tick rule.

Quotes surround the same event's trade by construction. Bid is not an executable promise, last trade is not a quote, and no market microstructure or trade-sign classification is modeled. Modulo mapping has slight bias. A deterministic PRNG is not cryptographic, independent randomness or calibrated market realism.

## Visible prefix

Cursor is an integer c=1..120; symbol index 0..5; bar width w is 5, 10 or 20. Only the generated tape is supported; arbitrary imported tick arrays are outside the helper contract. A snapshot uses events 1..c for that symbol. Changing future ticks cannot change a snapshot. No metric averages other symbols' prices or sums their incompatible price-volume notionals.

- Last = price at event c, bid/ask = quote at c.
- Change % = 100 × (last - invented prior close) / invented prior close. Not relative to the first visible trade.
- Spread = ask - bid; midpoint = (ask+bid)/2; spread bps = 10,000 × spread / midpoint. Bps is a quote-relative ratio, not percentage points or an execution-cost estimate.
- Prefix volume V = Σ size; price-volume N = Σ(price-in-cents × size); VWAP in cents = N/V. V is positive from event 1. Prefix VWAP path at each event uses its own growing prefix.
- Prefix high/low are extrema of the visible trade prices, not quote extrema. Breadth counts last-versus-prior up/down/unchanged among all six instruments.

VWAP here is exact trade-level price-volume accounting of all synthetic trades, not Σ(((H+L+C)/3)×bar volume)/Σbar volume. Vendor conventions about eligible trades, sessions and pre/post-market volume do not apply to this invented, single-session tape.

## Bars and plots

Group events 1..w, w+1..2w, and so on. For the observed part of each group, open = first price, high = maximum price, low = minimum price, close = last price, volume = sum of sizes. A bar is complete only when its observed length is w. No future high, low, close, volume or quote is included in a partial bar. Aggregated volume reconciles exactly with prefix volume for every width.

The price chart has a fixed horizontal event domain of 120 events. A bar's center is the mean of its visible start/end event positions; body width is proportional to its observed event count. Vertical scale uses only prefix high/low plus padding max(10 cents, 12% of visible range). Flat prices have a nonzero padded axis. Green indicates close >= open, coral close < open; it does not represent prior-close change. Partial bodies are hollow. Bodies with equal open/close use a minimum one-pixel height. A single-event VWAP has an explicit point. No trading volume plot or log scale.

## Precision and limits

All generated prices, sizes, volume and price-volume sums are small exact integers in Java long and JavaScript Number. Ratios and chart positions use binary64, not arbitrary precision. Display rounding is separate from sorting and arithmetic. The tests compare all Java/JS outputs, independently reconstruct the PRNG and OHLCV with Python integer operations, test no-lookahead by changing every future event, and check actual DOM chart coordinates and visible ledger values. Browser verification is Chrome and mobile-width emulation, not native Safari/Android certification.
