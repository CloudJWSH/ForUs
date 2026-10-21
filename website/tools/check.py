"""Prüft alle Seiten der Website: lokale Links und Anker, Bilder mit alt-Text, Formularfelder mit Label,
Titel, Beschreibung und Sprache, doppelte IDs, Bildgrößen. Dazu das ganze Repo auf Server-Adressen und Schlüssel,
denn es ist öffentlich.

Aufruf: python3 website/tools/check.py  (Exit-Code 1 bei Fehlern)
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
SKIP = {"src", "tools"}
# Was nie ins öffentliche Repo gehört: Server-Adressen (z. B. der Memebot), IP mit Port, Schlüssel und Tokens.
SECRETS = re.compile(r"sslip\.io|nip\.io|-----BEGIN [A-Z ]*PRIVATE KEY|\bghp_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{20,}"
                     r"|\b\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}\b|\b[1-9A-HJ-NP-Za-km-z]{87,88}\b")
TEXT = {".html", ".js", ".css", ".json", ".md", ".py", ".yml", ".yaml", ".txt", ".webmanifest", ".xml", ".svg"}
IMAGE_MAX = 300 * 1024      # je Bild, das die Seiten laden
ASSETS_MAX = 2 * 1024 * 1024  # assets/ und icons/ zusammen


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.imgs, self.inputs, self.labels = set(), [], [], [], set()
        self.dupes, self.lang, self.meta, self.title, self._in_title = set(), None, {}, "", False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:
                self.dupes.add(a["id"])
            self.ids.add(a["id"])
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "meta" and "name" in a:
            self.meta[a["name"]] = a.get("content", "")
        if tag == "title":
            self._in_title = True
        for key in ("href", "src"):
            if key in a and tag in ("a", "link", "img", "script"):
                self.links.append(a[key])
        if tag == "img":
            self.imgs.append(a)
        if tag == "input":
            self.inputs.append(a.get("id"))
        if tag == "label" and "for" in a:
            self.labels.add(a["for"])


    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def secrets():
    """Alle Textdateien im Repo nach Dingen durchsuchen, die nicht öffentlich sein dürfen."""
    found = []
    for path in ROOT.rglob("*"):
        parts = set(path.relative_to(ROOT).parts)
        if not path.is_file() or path.suffix not in TEXT or parts & {".git", "node_modules"}:
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if SECRETS.search(line):
                found.append(f"{path.relative_to(ROOT)}:{n}: sieht nach Server-Adresse oder Schlüssel aus")
    return found


def images():
    found, total = [], 0
    for folder in ("assets", "icons"):
        for path in (SITE / folder).rglob("*"):
            if path.is_file():
                total += path.stat().st_size
                if path.suffix in (".png", ".webp", ".jpg", ".svg") and path.stat().st_size > IMAGE_MAX:
                    found.append(f"{path.relative_to(SITE)}: Bild größer als {IMAGE_MAX // 1024} KB")
    if total > ASSETS_MAX:
        found.append(f"assets/ und icons/ zusammen {total // 1024} KB, erlaubt {ASSETS_MAX // 1024} KB")
    return found


def parse(path):
    p = Page()
    p.feed(path.read_text(encoding="utf-8"))
    return p


def main():
    pages = [p for p in SITE.rglob("*.html") if not SKIP & set(p.relative_to(SITE).parts)]
    parsed = {p: parse(p) for p in pages}
    errors = []
    for path, p in parsed.items():
        rel = path.relative_to(SITE)
        for link in p.links:
            if re.match(r"^(https?:|mailto:|data:)", link):
                continue
            target, _, anchor = link.partition("#")
            target = target.split("?")[0]
            dest = (path.parent / target).resolve() if target else path
            if not dest.exists():
                errors.append(f"{rel}: Ziel fehlt: {link}")
                continue
            if anchor and dest.suffix == ".html":
                ids = parsed.get(dest, None) or parse(dest)
                if anchor not in ids.ids:
                    errors.append(f"{rel}: Anker fehlt: {link}")
        for img in p.imgs:
            if not img.get("alt"):
                errors.append(f"{rel}: Bild ohne alt: {img.get('src')}")
        for i in p.inputs:
            if i and i not in p.labels:
                errors.append(f"{rel}: Feld ohne Label: {i}")
        if not p.title.strip():
            errors.append(f"{rel}: kein <title>")
        if not p.meta.get("description") and path.stem != "404":
            errors.append(f"{rel}: keine Beschreibung")
        if p.lang != ("en" if "en" in rel.parts[:-1] else "de"):
            errors.append(f"{rel}: falsche oder fehlende Sprache: {p.lang}")
        for d in sorted(p.dupes):
            errors.append(f"{rel}: ID doppelt: {d}")
    errors += images() + secrets()
    for e in errors:
        print(e)
    print(f"{len(pages)} Seiten geprüft, {len(errors)} Fehler")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
