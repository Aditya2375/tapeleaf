# tapeleaf

A Java-first mini market terminal with a deterministic, invented six-instrument session. Step the tape manually, select a symbol, sort a watchlist and compare quotes, trades, OHLCV bars and cumulative trade VWAP. Nothing is live, delayed, tradable or connected to an exchange.

## What it does

- Generates 120 events for each of six fictional symbols, using an integer-cent xorshift32 tape and a seed from 1 to 4,294,967,295. Each event contains one trade and a constructed symmetric bid/ask quote for each symbol.
- Provides mixed price steps, alternating positive/negative drifts and flat trade prices. Flat mode still varies quote spreads and sizes. Trade prices have a 1-unit floor to keep all quotes positive.
- Displays only the visible prefix, with manual First, -1, +1, +10, Last and range controls. A generated session starts at tick 30. The selected symbol and bar length are retained; no timer advances the tape.
- Shows last trade, change from invented prior close, bid, ask, spread in units and bps, prefix high/low, cumulative volume and trade-level VWAP.
- Aggregates consecutive events into 5, 10 or 20 tick OHLCV bars. The last bar is explicitly partial until its events are complete. The x-axis spans the full 120-event session, leaving the unseen part empty.
- Provides exact visible bar values and the last 10 visible trades, newest first. Sorting uses unrounded visible change or spread bps; ties use original symbol order. Selection and replay are independent.

These are invented instruments, price units, sizes and prior closes, not actual securities, market observations, prices, timestamps or currency. There is no order book, matching engine, fill model, real-time clock, data feed, strategy, profit claim or investment recommendation. The entire deterministic tape is in memory: prefix isolation is an interface/accounting property, not a secure barrier against future access or a backtest.

## Run

Java 21+, Node 22+, Chrome for browser checks, Python 3.12+ for the independent standard-library reference. No runtime packages or external assets.

```sh
javac -d build/classes src/tapeleaf/*.java tools/*.java tests/tapeleaf/*.java
java -cp build/classes tapeleaf.TestRunner
node tests/parity.mjs
node tests/domain.mjs
python3 tests/reference.py
node tools/build-web.mjs
node tests/browser-smoke.mjs
python3 -m http.server 8000 --directory docs
```

Open the printed local URL. `src/tapeleaf/` is the Java engine, `web/src/` its browser port, and `docs/` the checked-in static host artifact. `node tools/build-web.mjs` copies exactly four assets. CI rebuilds it and checks drift, numerical tests, browser behavior and local security rules. Local tests can use `JAVA=/path/to/java node tests/parity.mjs` when Java is not on PATH.

No accounts, uploads, saved settings, telemetry, browser storage, runtime requests to other origins, API keys or trades. Refresh resets the session. External definition links are ordinary links, never loaded by the application.

## Numerical details and definitions

See [NUMERICS.md](NUMERICS.md). The UI and tests use cent integers for prices, integer sizes and integer price-volume accounting within exact JavaScript integer range. Only ratios and plot coordinates use floating point. VWAP displays four decimals; trade and OHLC prices display two. Rounded percentage ties can conceal a difference in the unrounded sort key.

Definitions were checked against [Investor.gov bid/ask](https://www.investor.gov/introduction-investing/investing-basics/glossary/ask-price), [Investor.gov stock quotes](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-quotes), [StockCharts bar aggregation](https://help.stockcharts.com/data-and-ticker-symbols/data-availability/data-bar-periods), [Investopedia trade VWAP](https://www.investopedia.com/terms/v/vwap.asp) and [Morningstar change %](https://awgmain.morningstar.com/webhelp/glossary_definitions/accounts/Price_Change.htm). Their market definitions do not imply these invented sessions are realistic.

## License

Original code and documentation are **MIT OR Apache-2.0**, at your choice. See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE). No third-party code, data, fonts, papers or images are bundled. Linked sources remain their authors' work.
