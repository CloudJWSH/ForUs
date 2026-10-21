# Pump Paper Website

Statische Produktseite für die Chrome-Erweiterung Pump Paper (Papertrading auf pump.fun). Kein Build-Werkzeug nötig, nur Python 3 (Pillow optional für WebP-Bilder).

| Datei | Inhalt |
| --- | --- |
| `index.html`, `en/index.html` | Startseite mit Demo und Rechner. Navigation, Kopf, Version, Neuerungen und Coin-Teil zwischen `<!-- … -->`-Markern trägt `tools/build.py` ein. |
| `src/*.html`, `src/en/*.html` | Inhalt der Unterseiten (Anleitung, Lexikon, Üben, Konto, Datenschutz, 404). Daraus baut `tools/build.py` die fertigen Seiten. |
| `changelog.html` | Wird aus `extension/CHANGELOG.md` und `CHANGELOG.en.md` gebaut. |
| `coin.json` | Coin-Teil (Abschnitt, Seite `coin.html`, Menü-Link). Bleibt aus, bis `live` auf `true` steht. Nur öffentliche Adressen eintragen. |
| `site.json` | `base_url` der fertigen Website. Leer lassen, solange sie nicht veröffentlicht ist; dann gibt es auch keine Sitemap. |
| `assets/site.css`, `assets/site.js` | Aussehen, helles/dunkles Design, Menü, Sprachumschalter, Kopieren, Bildansicht. |
| `assets/demo.js`, `rechner.js`, `stop.js`, `share.js` | Demo-Coin, Rechner auf der Startseite und in der Anleitung, Teilen-Links. |
| `assets/konto.js` | Konto-Seite: Beispieldaten, CSV-Auswertung, liest das Konto aus der Erweiterung (nur lesend). |
| `assets/coin.js` | Live-Zahlen des Coins (DexScreener, Solana-RPC), nur aktiv wenn der Coin live ist. |
| `assets/og.png`, `assets/og-coin.png` | Teilen-Bilder, Vorlagen `tools/og.html` und `tools/og-coin.html`. |

## Bauen und prüfen

```
python3 website/tools/build.py            # Seiten bauen
python3 website/tools/build.py --coin-preview   # Coin-Teil mit Platzhaltern ansehen, danach normal bauen!
python3 website/tools/check.py            # Links, Anker, alt-Texte, Labels, Titel, Sprache, doppelte IDs,
                                          # Bildgrößen und das ganze Repo auf Server-Adressen und Schlüssel
node website/tools/smoke.js               # Rauchtest im Browser (npm-Paket playwright nötig)
```

Auf GitHub erledigen das die Workflows:

- `pump-paper-release.yml`: bei Änderungen in `extension/` Zip bauen, Release `v<version>` anlegen, Website neu bauen.
- `website-build.yml`: bei Änderungen an Quellen, Assets, `coin.json` oder `site.json` neu bauen, prüfen und den Rauchtest laufen lassen.

Der Download-Knopf zeigt immer auf `releases/latest/download/Pump-Paper.zip`.

Bilder der Erweiterung (`assets/shots/`) zeichnet `tools/shots/shots.js` mit dem echten Code aus `extension/` und Beispieldaten aus `tools/shots/mock.js`. Der Release-Workflow macht das bei jeder neuen Version selbst. Bilder und Texte für den Chrome Web Store liegen in `store/` (siehe `store/README.md`).

## Begriffe

Deutsch: Marktwert (nicht Market Cap), Ziel, Stop, Zeit, Konto, Verlauf, Gebühr, Slippage. Englisch: market cap, target, stop, time limit, account, history, fee, slippage. Die Oberfläche der Erweiterung ist Deutsch, die englischen Seiten nennen die deutschen Beschriftungen mit.

## Ladezeit

Gemessen am 21.10.2026 mit Handy-Breite und gedrosselter Verbindung (1,6 Mbit/s, 150 ms), ohne Kompression und ohne Webfonts:

| Seite | Daten beim Laden | Erste Anzeige |
| --- | --- | --- |
| Startseite | ca. 100 KB | 0,8 s |
| Anleitung | ca. 66 KB | 0,7 s |
| Lexikon | ca. 61 KB | 0,7 s |
| Konto | ca. 87 KB | 0,8 s |

Screenshots laden erst beim Hinscrollen und kommen als WebP.

## Nicht ins Repo

Das Repo ist öffentlich. Keine Server-Adressen (z. B. des Memebots), keine Schlüssel, keine privaten Wallet-Daten. `check.py` schlägt Alarm, wenn so etwas auftaucht.
