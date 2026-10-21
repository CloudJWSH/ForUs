# Pump Paper Website

Statische Produktseite für die Chrome-Erweiterung Pump Paper (Papertrading auf pump.fun). Kein Build-Werkzeug nötig, nur Python 3.

| Datei | Inhalt |
| --- | --- |
| `index.html` | Startseite mit Rechner. Navigation, Version und Neuerungen zwischen `<!-- … -->`-Markern trägt `tools/build.py` ein. |
| `src/*.html` | Inhalt der Unterseiten (Anleitung, Datenschutz, 404). Daraus baut `tools/build.py` die fertigen Seiten. |
| `changelog.html` | Wird aus `extension/CHANGELOG.md` gebaut. |
| `assets/site.css`, `assets/rechner.js` | Gemeinsames Aussehen, Rechner auf der Startseite. |
| `assets/og.png` | Vorschaubild beim Teilen, Vorlage `tools/og.html`. |

Nach Änderungen: `python3 website/tools/build.py`. Auf GitHub erledigen das die Workflows:

- `pump-paper-release.yml`: bei Änderungen in `extension/` Zip bauen, Release `v<version>` anlegen, Website neu bauen.
- `website-build.yml`: bei Änderungen in `website/src` oder `website/tools` Website neu bauen.

Der Download-Knopf zeigt immer auf `releases/latest/download/Pump-Paper.zip`.
