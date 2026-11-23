// cbBTC holder with a wide protective trailing stop, for make.fun's
// "Race a BTC trading bot live for 24 hours" (bars-replay/v1).
//
// The window is raced live and nobody, the organisers included, has seen its
// prices when entries close, so the bot does not try to time the market: it
// takes the asset once and rides it. Only a bot that made money on the dev
// window races, and the dev window is one path, so a fitted signal that looks
// good on it is a fitted signal. This one carries no fitted threshold that
// matters: it is long cbBTC for the whole window and leaves only when the tape
// breaks badly enough that being in cash is the better side.
//
//   - Entry: on the first batch that can trade (bar 1, after the opening
//     minute is known) and while it holds nothing, it spends everything it has
//     on cbBTC. Orders decided on bar k fill at bar k + 1's open; the entry is
//     retried on the next few bars if the market refuses it (no bar, or a
//     price past the slippage cap), so a broken first minute cannot leave the
//     bot out of the race with no trade at all.
//   - Exit: while it holds, it remembers the highest close seen since the
//     entry. It sells the whole position when the close is 8% under that peak
//     (a break, not a wiggle: the dev window's own peak-to-trough is under 2%,
//     so a fair window never trips it) or 12% under the entry reference, a
//     backstop. A flat bot does not buy back: after a break it stays in cash,
//     which is the whole point of leaving.
//   - Sizing: the whole cash balance, capped by the weight cap the hello
//     names, so the position is one order and at most 100% of equity.
//   - Determinism: integer bigint arithmetic on the raw closes and the account
//     the harness sends, no clock, no environment, no files, no randomness.
//     The same bars give the same orders, run after run.

import { BPS, runBars, type BarsState, type BuyInput, type SellInput, type OrderInput } from './vendor/makefun-bars.ts';

/** Exit when the close is this many bps under the highest close since the entry (8%). */
const TRAIL_BPS = 800n;
/** Exit when the close is this many bps under the entry's close, a backstop (12%). */
const HARD_BPS = 1200n;
/** Leave the slippage cap wide open: a hold that misses its fill is a hold that never happened. */
const MAX_SLIPPAGE_BPS = 10_000;
/** The first batch an entry may be decided on: bar 1, once the opening minute has closed. */
const ENTRY_FROM = 1;
/** The last batch an entry may be decided on: a held-up entry repairs within a quarter of an hour. */
const ENTRY_TO = 15;

/** The one asset the universe holds. */
function universe(state: BarsState): string | null {
  const first = state.hello.symbols[0];
  return first === undefined ? null : first.symbol;
}

/** The full-size buy of this reply: all the cash, within the weight cap and the min notional. */
function entryOrder(state: BarsState, symbol: string): BuyInput[] {
  const room = state.weightRoom(symbol);
  const spend = state.cash < room ? state.cash : room;
  const floor = BigInt(state.hello.fees.min_notional_quote_units);
  if (spend < floor) return [];
  return [{ side: 'buy', symbol, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

/** Everything the bot remembers between batches. */
interface Memory {
  /** True from the first batch an entry was decided on: the bot only ever takes one. */
  triedEntry: boolean;
  /** True once the position has been sold: a broken bot stays in cash. */
  steppedOut: boolean;
  /** The highest close seen while it held, the trailing stop's reference. */
  peak: bigint;
  /** The close the position was entered on, the backstop stop's reference. */
  entryRef: bigint;
}

const memory: Memory = { triedEntry: false, steppedOut: false, peak: 0n, entryRef: 0n };

/** The orders this batch's close decides: enter, stay, or leave. */
function decide(state: BarsState, seq: number): OrderInput[] {
  if (state.warmingUp) return [];
  const symbol = universe(state);
  if (symbol === null) return [];
  const close = state.close(symbol);
  if (close === null) return [];

  const holding = state.positions.get(symbol);

  if (holding !== undefined) {
    // Long: ride it, and mark the peak this close carries.
    if (close > memory.peak) memory.peak = close;
    const trailLine = (memory.peak * (BPS - TRAIL_BPS)) / BPS;
    const hardLine = (memory.entryRef * (BPS - HARD_BPS)) / BPS;
    if (close <= trailLine || close <= hardLine) {
      memory.steppedOut = true;
      const sell: SellInput = { side: 'sell', symbol, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [sell];
    }
    return [];
  }

  // Flat: only a first entry is possible; a bot that stepped out stays out. A buy
  // decided on bar k fills at bar k + 1's open, so the position shows on the next
  // batch: while this bot still sees no position, the market refused the last buy
  // and the entry is sent again, until the entry window closes.
  if (memory.steppedOut) return [];
  if (seq < ENTRY_FROM || seq > ENTRY_TO) return [];
  const orders = entryOrder(state, symbol);
  if (orders.length > 0 && !memory.triedEntry) {
    memory.triedEntry = true;
    memory.entryRef = close;
    memory.peak = close;
  }
  return orders;
}

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    return decide(state, state.seq);
  },
});
