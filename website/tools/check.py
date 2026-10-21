"""Prüft alle Seiten der Website: lokale Links und Anker, Bilder mit alt-Text, Formularfelder mit Label,
Titel, Beschreibung und Sprache, Überschriften-Reihenfolge, doppelte IDs, Bildgrößen, Kontrast, Bildmaße, tabindex,\nfremde Skripte, Diagramme ohne Beschreibung, Sprachpaare. Dazu das ganze Repo auf Server-Adressen und Schlüssel,
denn es ist öffentlich.

Aufruf: python3 website/tools/check.py  (Exit-Code 1 bei Fehlern)
"""
import json
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
        self.heads = []
        self.problems = []  # Zugänglichkeit und Sicherheit je Tag

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
        if re.fullmatch(r"h[1-6]", tag):
            self.heads.append(int(tag[1]))
        for key in ("href", "src"):
            if key in a and tag in ("a", "link", "img", "script"):
                self.links.append(a[key])
        if tag == "img":
            self.imgs.append(a)
        if tag == "input":
            self.inputs.append(a.get("id"))
        if tag == "label" and "for" in a:
            self.labels.add(a["for"])
        if tag == "img" and not (a.get("width") and a.get("height")):
            self.problems.append(f"Bild ohne width/height (springt beim Laden): {a.get('src')}")
        if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
            self.problems.append(f"Link mit target=_blank ohne rel=noopener: {a.get('href')}")
        if (a.get("tabindex") or "0").lstrip("-").isdigit() and int(a.get("tabindex") or 0) > 0:
            self.problems.append(f"tabindex > 0 stört die Fokus-Reihenfolge: <{tag}>")
        if tag == "script" and re.match(r"^(https?:)?//", a.get("src", "")):
            self.problems.append(f"Fremdes Skript: {a['src']}")
        if tag == "link" and a.get("rel") == "stylesheet" and re.match(r"^(https?:)?//", a.get("href", "")) \
                and not a["href"].startswith("https://fonts.googleapis.com/"):
            self.problems.append(f"Fremdes Stylesheet: {a['href']}")
        if tag == "canvas" and not a.get("aria-label"):
            self.problems.append("Diagramm (canvas) ohne aria-label")
        if tag == "svg" and a.get("aria-hidden") != "true" and not (a.get("role") == "img" and (a.get("aria-label") or a.get("aria-labelledby"))):
            self.problems.append(f"SVG ohne aria-hidden oder role=img mit Beschreibung: {a.get('class') or a.get('id')}")


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


def schema_errors(value, schema, root, where="$"):
    """Kleiner JSON-Schema-Prüfer für die Teile, die strategy.schema.json nutzt."""
    if "$ref" in schema:
        schema = root["$defs"][schema["$ref"].split("/")[-1]]
    errs = []
    types = schema.get("type")
    if types:
        types = types if isinstance(types, list) else [types]
        ok = {"object": dict, "string": str, "null": type(None), "array": list}
        def fits(t):
            if t in ("number", "integer"):
                return isinstance(value, (int, float)) and not isinstance(value, bool) and (t == "number" or float(value).is_integer())
            return isinstance(value, ok[t])
        if not any(fits(t) for t in types):
            return [f"{where}: erwartet {'/'.join(types)}"]
    if "const" in schema and value != schema["const"]:
        errs.append(f"{where}: muss {schema['const']!r} sein")
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{where}: nicht erlaubt: {value!r}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errs.append(f"{where}: kleiner als {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errs.append(f"{where}: größer als {schema['maximum']}")
    if isinstance(value, str) and len(value) > schema.get("maxLength", 10**9):
        errs.append(f"{where}: zu lang")
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                errs.append(f"{where}: {key} fehlt")
        for key, v in value.items():
            if key in props:
                errs += schema_errors(v, props[key], root, f"{where}.{key}")
            elif schema.get("additionalProperties") is False:
                errs.append(f"{where}: unbekanntes Feld {key}")
    return errs


def strategies():
    """Beispiel-Strategien gegen das Schema prüfen."""
    folder = SITE / "strategien"
    schema_path = folder / "strategy.schema.json"
    if not schema_path.exists():
        return []
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    found = []
    for path in sorted(folder.glob("*.json")):
        if path == schema_path:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as e:
            found.append(f"strategien/{path.name}: kein gültiges JSON ({e})")
            continue
        found += [f"strategien/{path.name}: {e}" for e in schema_errors(data, schema, schema)]
    return found


def contrast():
    """Text-Farben gegen alle Hintergründe, dunkel und hell: mindestens 4,5:1 (WCAG AA)."""
    css = (SITE / "assets" / "site.css").read_text(encoding="utf-8")
    grab = lambda block: dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", block))
    start = css.index(":root {")
    dark = grab(css[start:css.index("}", start)])
    lstart = css.index(':root[data-theme="light"] {')
    themes = {"dunkel": dark, "hell": {**dark, **grab(css[lstart:css.index("}", lstart)])}}

    def lum(h):
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    def ratio(a, b):
        hi, lo = sorted((lum(a), lum(b)), reverse=True)
        return (hi + 0.05) / (lo + 0.05)

    out = []
    for name, v in themes.items():
        pairs_ = [(fg, bg) for fg in ("ink", "muted", "gold-ink", "gain", "loss") for bg in ("bg", "panel", "raise", "gold-soft")] + [("on-gold", "gold")]
        for fg, bg in pairs_:
            r = ratio(v[fg], v[bg])
            if r < 4.5:
                out.append(f"site.css: Kontrast {name} --{fg} auf --{bg} nur {r:.2f}:1")
    return out


PAGE_MAX = 220 * 1024  # HTML, CSS und JS einer Seite zusammen, ungepackt (Bilder laden später)


def weight(pages):
    """Ladegewicht je Seite ohne Bilder und Schriften: hält die erste Anzeige auf langsamen Handys schnell."""
    out = []
    for p in pages:
        text = p.read_text(encoding="utf-8")
        total = len(text.encode())
        for src in set(re.findall(r'(?:src|href)="([^"#?:]+\.(?:js|css))(?:\?[^"]*)?"', text)):
            f = (p.parent / src).resolve()
            total += f.stat().st_size if f.exists() else 0
        if total > PAGE_MAX:
            out.append(f"{p.relative_to(SITE)}: {total // 1024} KB HTML/CSS/JS, erlaubt {PAGE_MAX // 1024} KB")
    return out


def globals_():
    """Skripte der Website laufen in einer eigenen Funktion, nur kurve.js und strategie.js geben je einen Namen nach außen."""
    out = []
    for f in sorted((SITE / "assets").glob("*.js")):
        for m in re.finditer(r"^(?:const|let|var|function|class) +(\w+)", f.read_text(encoding="utf-8"), re.M):
            out.append(f"assets/{f.name}: globaler Name {m.group(1)}")
    return out


def pairs():
    """Jede deutsche Seite hat eine englische und umgekehrt (Liste PAGES in build.py)."""
    sys.path.insert(0, str(SITE / "tools"))
    import build
    out = []
    for row in build.PAGES:
        if row["de"] == "coin":
            continue
        de, en = SITE / f"{row['de']}.html", SITE / "en" / f"{row['en']}.html"
        if de.exists() != en.exists():
            out.append(f"Sprachpaar unvollständig: {de.name} / en/{en.name}")
    names = {r["de"] for r in build.PAGES}
    out += [f"{p.name}: fehlt in PAGES (build.py)" for p in (SITE / "src").glob("*.html") if p.stem not in names]
    return out


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
        if p.heads.count(1) != 1:
            errors.append(f"{rel}: {p.heads.count(1)} h1 statt genau einer")
        for a, b in zip(p.heads, p.heads[1:]):
            if b > a + 1:
                errors.append(f"{rel}: Überschrift springt von h{a} auf h{b}")
                break
        for d in sorted(p.dupes):
            errors.append(f"{rel}: ID doppelt: {d}")
        errors += [f"{rel}: {x}" for x in p.problems]
    errors += images() + secrets() + strategies() + contrast() + pairs() + weight(pages) + globals_()
    for e in errors:
        print(e)
    print(f"{len(pages)} Seiten geprüft, {len(errors)} Fehler")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
