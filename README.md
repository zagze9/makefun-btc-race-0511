# makefun-btc-race-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/zagze9/makefun-btc-race-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/zagze9/makefun-btc-race-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A cbBTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours"
bounty (bars-replay/v1), written in TypeScript for Node 22. It reads one JSON
line per minute — a 1-minute bar of cbBTC priced in USDC from its Orca
Whirlpool on Solana — and answers with buy and sell orders.

The window it races is live and unseen when entries close, so the bot does not
try to time it. It is long cbBTC for the whole window and carries a wide
protective trailing stop (8% under the highest close since the entry) plus a
12% backstop under the entry price; a window that merely wiggles is ridden to
the end, and a window that breaks badly is left, into cash, for good. It sizes
each order with integer bigint arithmetic on the raw closes and the account the
harness sends — no clock, no environment, no files, no randomness — so two runs
on the same bars produce byte-identical orders.

## Run it

```sh
# grade it on the kit's dev window exactly as the server does
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver docker
```

The entry point is `main.ts` at the repository root; `vendor/makefun-bars.ts`
is a byte-identical copy of the kit's Python/TypeScript wire shim that speaks
`agent-fun/bars-replay/v1`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=xf9vrch5&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
