# Änderungen

Neueste Version oben. Überschrift je Version: `## <Version> · <Datum>`. Jede Zeile mit `- ` wird auf der Website und im Release angezeigt.

## 1.4.0 · 21.10.2026

- Ausführung nach einer einstellbaren Verzögerung (Standard 1 s) zum Kurs, der dann gilt. Die festen 2 % Puffer fallen weg.
- Slippage-Grenze wie bei pump.fun (Standard 10 %). Liegt der Kurs bei Ausführung zu weit weg, scheitert der Trade und kostet nur die Priority Fee.
- Ziel-, Stop- und Zeitverkäufe laufen ohne Slippage-Grenze und landen im Absturz schlechter als die Marke.
- Konto-Miete von 0,00204 SOL beim ersten Kauf eines Coins.
- Antwortet der Solana-Zugang nicht, nimmt Pump Paper automatisch einen zweiten. Das Panel zeigt dann einen Hinweis.
- Memebot-Adresse ist nicht mehr voreingestellt und wird in den Optionen eingetragen.

## 1.3

- Panel unter dem Kaufbereich der pump.fun-Coinseite, kaufen in SOL oder USDC, verkaufen mit 25 %, 50 % oder alles.
- Kurs und Gebühr direkt von der Blockchain, aus der Bonding-Kurve oder dem PumpSwap-Pool, Gebühr je Coin nach Marktwert, live per Abo.
- Ziel, Stop und Zeitlimit je Position mit automatischem Verkauf.
- Käufe, Verkäufe, Ziel und Stop als Marker und Linien im pump.fun-Chart.
