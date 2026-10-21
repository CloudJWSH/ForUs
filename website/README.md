# Pump Paper Website

Statische Produktseite für die Chrome-Erweiterung Pump Paper (Papertrading auf pump.fun). Kein Build-Werkzeug nötig, nur Python 3.

| Datei | Inhalt |
| --- | --- |
| `index.html` | Startseite mit Rechner. Navigation, Version und Neuerungen zwischen `<!-- … -->`-Markern trägt `tools/build.py` ein. |
| `src/*.html` | Inhalt der Unterseiten (Anleitung, Lexikon, Datenschutz, 404). Daraus baut `tools/build.py` die fertigen Seiten. |
| `en/index.html`, `src/en/*.html` | Englische Fassung (Startseite, Guide, Glossary, Privacy, 404). Sprachumschalter EN/DE im Kopf. |
| `changelog.html` | Wird aus `extension/CHANGELOG.md` gebaut. |
| `assets/site.css`, `assets/rechner.js` | Gemeinsames Aussehen, Rechner auf der Startseite. |
| `assets/og.png` | Vorschaubild beim Teilen, Vorlage `tools/og.html`. |

Nach Änderungen: `python3 website/tools/build.py`. Auf GitHub erledigen das die Workflows:

- `pump-paper-release.yml`: bei Änderungen in `extension/` Zip bauen, Release `v<version>` anlegen, Website neu bauen.
- `website-build.yml`: bei Änderungen in `website/src` oder `website/tools` Website neu bauen.

Der Download-Knopf zeigt immer auf `releases/latest/download/Pump-Paper.zip`.

Bilder der Erweiterung (`assets/shots/`) zeichnet `tools/shots/shots.js` mit dem echten Code aus `extension/` und Beispieldaten aus `tools/shots/mock.js`. Der Release-Workflow macht das bei jeder neuen Version selbst.
