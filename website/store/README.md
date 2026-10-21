# Chrome Web Store: Material für Pump Paper

Alles, was für den Eintrag im Chrome Web Store gebraucht wird. Die Bilder baut `website/tools/store/store.js`
aus `tools/store/frame.html` und den echten Bildern in `assets/shots/`.

## Bilder

| Datei | Größe | Verwendung |
| --- | --- | --- |
| `panel-de.png`, `echt-de.png`, `konto-de.png`, `verlauf-de.png` | 1280×800 | Screenshots (deutscher Eintrag), in dieser Reihenfolge |
| `panel-en.png`, `echt-en.png`, `konto-en.png`, `verlauf-en.png` | 1280×800 | Screenshots (englischer Eintrag) |
| `tile-de.png`, `tile-en.png` | 440×280 | Kleine Werbekachel |
| `marquee-de.png`, `marquee-en.png` | 1400×560 | Banner (Marquee) |
| `../../extension/icons/128.png` | 128×128 | Symbol |

## Eintrag Deutsch

**Name:** Pump Paper

**Kurzbeschreibung** (höchstens 132 Zeichen):
Papertrading auf pump.fun mit Spielgeld. Echte Bonding-Kurve, echte Gebühren, Verzögerung und Slippage. Kein Wallet nötig.

**Beschreibung:**

Pump Paper legt ein Papier-Konto direkt auf die pump.fun-Coinseite. Du kaufst und verkaufst wie gewohnt, nur mit Spielgeld und ohne Wallet.

So rechnet Pump Paper:
• Kurs direkt von der Blockchain, aus der Bonding-Kurve oder dem PumpSwap-Pool
• Gebühr je Coin nach Marktwert, aus der Gebühren-Konfiguration von pump.fun
• Ausführung nach einstellbarer Verzögerung (Standard 1 s) zum Kurs, der dann gilt
• Slippage-Grenze wie bei pump.fun: gescheiterte Trades kosten die Priority Fee
• Konto-Miete beim ersten Kauf eines Coins

Funktionen:
• Panel unter dem Kaufbereich, kaufen in SOL oder USDC, verkaufen mit 25 %, 50 % oder alles
• Ziel, Stop und Zeitlimit je Position, automatischer Verkauf auch im Hintergrund
• Käufe, Verkäufe, Ziel und Stop im pump.fun-Chart
• Verlauf mit Trefferquote, Gebühren und CSV-Export

Kein Konto, kein Server, kein Wallet. Alle Daten bleiben im Browser.

Pump Paper ist ein unabhängiges Übungswerkzeug und gehört nicht zu pump.fun. Keine Anlageberatung.

**Kategorie:** Werkzeuge (Tools)

## Eintrag Englisch

**Name:** Pump Paper

**Short description** (max. 132 characters):
Paper trading on pump.fun with play money. Real bonding curve, real fees, delay and slippage. No wallet needed.

**Description:**

Pump Paper puts a paper account right on the pump.fun coin page. You buy and sell the way you always do, just with play money and without a wallet.

How Pump Paper prices trades:
• Price straight from the blockchain, from the bonding curve or the PumpSwap pool
• Per-coin fee by market cap, from pump.fun's fee config
• Execution after an adjustable delay (default 1 s) at the price that holds then
• Slippage limit like pump.fun: failed trades cost the priority fee
• Account rent on the first buy of a coin

Features:
• Panel below the trade box, buy in SOL or USDC, sell 25 %, 50 % or everything
• Target, stop and time limit per position, automatic selling even in the background
• Buys, sells, target and stop in the pump.fun chart
• History with hit rate, fees and CSV export

No account, no server, no wallet. All data stays in your browser.

The interface is in German for now.

Pump Paper is an independent practice tool and not affiliated with pump.fun. Not financial advice.

## Datenschutz-Angaben (Reiter „Datenschutz“ im Developer Dashboard)

**Einziger Zweck:** Papertrading auf pump.fun: Trades mit Spielgeld simulieren und zu echten Kursen der Blockchain abrechnen.

**Begründung der Berechtigungen:**
- `storage`: Papier-Konto, Positionen, Verlauf und Einstellungen lokal speichern.
- `alarms`: Ziel, Stop und Zeitlimit alle 30 Sekunden prüfen, auch wenn keine Coinseite offen ist.
- Zugriff auf `pump.fun`: Panel und Chart-Marker auf der Coinseite einzeichnen.
- Zugriff auf `api.mainnet-beta.solana.com`, `solana-rpc.publicnode.com`: Reserven der Kurve oder des Pools und Gebühren lesen.
- Zugriff auf `api.dexscreener.com`: SOL-Kurs in Dollar und Ersatzkurs.
- Optionaler Zugriff auf andere Adressen: nur nach Nachfrage, für einen eigenen Solana-Zugang oder Memebot-Server, den der Nutzer selbst einträgt.

**Datennutzung:** Es werden keine Nutzerdaten erhoben oder übertragen.

**Datenschutzerklärung (URL):** die Seite `datenschutz.html` (englisch `en/privacy.html`), sobald die Website gehostet ist.
