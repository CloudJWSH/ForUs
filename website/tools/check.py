"""Prüft alle Seiten der Website: lokale Links und Anker, Bilder mit alt-Text, Formularfelder mit Label.

Aufruf: python3 website/tools/check.py  (Exit-Code 1 bei Fehlern)
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
SKIP = {"src", "tools"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.imgs, self.inputs, self.labels = set(), [], [], [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if key in a and tag in ("a", "link", "img", "script"):
                self.links.append(a[key])
        if tag == "img":
            self.imgs.append(a)
        if tag == "input":
            self.inputs.append(a.get("id"))
        if tag == "label" and "for" in a:
            self.labels.add(a["for"])


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
    for e in errors:
        print(e)
    print(f"{len(pages)} Seiten geprüft, {len(errors)} Fehler")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
