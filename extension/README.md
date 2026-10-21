# Pump Paper (Erweiterung)

Quellcode der Chrome-Erweiterung. Neue Version: Dateien hier ersetzen und `version` in `manifest.json` erhöhen.
Neuerungen in `CHANGELOG.md` (deutsch) und `CHANGELOG.en.md` (englisch) eintragen.
Nach dem Push baut `.github/workflows/pump-paper-release.yml` automatisch die Zip, legt das Release `v<version>` an
und trägt die Version auf der Website ein. Der Download-Link der Website zeigt immer auf die neueste Zip.

Öffentliche Fassung: keine Server-Adressen oder Zugangsdaten einchecken (Memebot-Adresse bleibt leer und wird in den Optionen eingetragen).
