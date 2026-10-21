# Changes

Newest version first. Same structure as CHANGELOG.md (German): `## <version> · <date>`, then lines starting with `- `.

## 1.4.0 · 2026-10-21

- Trades fill after an adjustable delay (default 1 s) at the price that holds then. The fixed 2 % buffer is gone.
- Slippage limit like pump.fun (default 10 %). If the price at execution is too far off, the trade fails and only costs the priority fee.
- Target, stop and time sells have no slippage limit and land worse than the mark in a crash.
- Account rent of 0.00204 SOL on the first buy of a coin.
- If the Solana endpoint doesn't answer, Pump Paper switches to a second one on its own. The panel then shows a notice.
- The memebot address is no longer preset and is entered in the options.

## 1.3

- Panel below the trade box on the pump.fun coin page, buy in SOL or USDC, sell 25 %, 50 % or everything.
- Price and fee straight from the blockchain, from the bonding curve or the PumpSwap pool, per-coin fee by market cap, live via subscription.
- Target, stop and time limit per position with automatic selling.
- Buys, sells, target and stop as markers and lines in the pump.fun chart.
