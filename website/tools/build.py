"""Baut die Unterseiten der Pump-Paper-Website und trägt Version und Neuerungen ein.

Quellen:
  website/src/*.html        Inhalt je Unterseite, Kopf mit <!-- title: … --> und <!-- description: … -->
  extension/manifest.json   aktuelle Version
  extension/CHANGELOG.md    Änderungen je Version (## <Version> · <Datum>, darunter Zeilen mit "- ")

Ergebnis:
  website/<name>.html       Unterseiten mit gemeinsamem Kopf und Fuß
  website/changelog.html    Änderungsprotokoll
  website/index.html        Navigation, Versionsnummer und Liste der Neuerungen zwischen den Markern

Aufruf: python3 website/tools/build.py (läuft auch im Release-Workflow).
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "website"
EXT = ROOT / "extension"
DOWNLOAD = "https://github.com/CloudJWSH/ForUs/releases/latest/download/Pump-Paper.zip"

NAV = [
    ("index.html#rechnung", "So rechnet es", None),
    ("anleitung.html", "Anleitung", "anleitung"),
    ("changelog.html", "Änderungen", "changelog"),
    ("index.html#fragen", "Fragen", None),
]

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f2b33d"/>'
        '<path d="M7 21.5l6.5-6.5 4.5 4.5L25 11" fill="none" stroke="#1a1304" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>')


def nav(current=None, home=False):
    links = []
    for href, label, key in NAV:
        if home and href.startswith("index.html#"):
            href = href[len("index.html"):]
        cur = ' aria-current="page"' if key and key == current else ""
        links.append(f'<a href="{href}"{cur}>{label}</a>')
    return ('<nav aria-label="Seite">\n      ' + "\n      ".join(links) + "\n    </nav>\n"
            f'    <a class="btn gold small" href="{"#installieren" if home else "index.html#installieren"}">Holen</a>')


def header(current=None):
    return f"""<header class="top">
    <a class="brand" href="index.html">
      {LOGO}
      Pump Paper
    </a>
    {nav(current)}
  </header>"""


FOOTER = f"""<footer>
    <a class="brand" href="index.html">
      {LOGO}
      Pump Paper
    </a>
    <p>Papertrading mit Spielgeld. Kein echtes Geld, keine Anlageberatung. Pump Paper ist ein unabhängiges Projekt und gehört nicht zu pump.fun.</p>
    <nav class="foot-nav" aria-label="Weitere Seiten"><a href="anleitung.html">Anleitung</a><a href="changelog.html">Änderungen</a><a href="datenschutz.html">Datenschutz</a><a href="https://github.com/CloudJWSH/ForUs">Quellcode</a></nav>
  </footer>"""


def page(name, title, description, body):
    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:image" content="assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="icons/48.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<div class="wrap">
  {header(name)}
{body.rstrip()}
  {FOOTER}
</div>
</body>
</html>
"""


def changelog():
    text = (EXT / "CHANGELOG.md").read_text(encoding="utf-8")
    versions = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        head, *lines = block.splitlines()
        items = [l[2:].strip() for l in lines if l.startswith("- ")]
        ver, _, date = head.partition("·")
        versions.append((ver.strip(), date.strip(), items))
    return versions


def items_html(items, indent):
    pad = " " * indent
    return "\n".join(f"{pad}<li>{html.escape(i)}</li>" for i in items)


def replace_marker(text, name, value):
    pattern = re.compile(rf"(<!-- {name} -->)(.*?)(<!-- /{name} -->)", re.S)
    if not pattern.search(text):
        raise SystemExit(f"Marker {name} fehlt")
    return pattern.sub(lambda m: m.group(1) + value + m.group(3), text)


def main():
    version = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))["version"]
    versions = changelog()

    for src in sorted((SITE / "src").glob("*.html")):
        raw = src.read_text(encoding="utf-8")
        title = re.search(r"<!-- title: (.*?) -->", raw).group(1)
        desc = re.search(r"<!-- description: (.*?) -->", raw).group(1)
        body = re.sub(r"<!-- (title|description): .*? -->\n?", "", raw)
        body = body.replace("{{version}}", version).replace("{{download}}", DOWNLOAD)
        (SITE / src.name).write_text(page(src.stem, title, desc, body), encoding="utf-8")

    entries = []
    for i, (ver, date, items) in enumerate(versions):
        tag = '<span class="st">Neu</span>' if i == 0 else ""
        when = f'<span class="when">{html.escape(date)}</span>' if date else ""
        entries.append(f"""    <article class="release" id="v{html.escape(ver)}">
      <div class="release-head"><h2>{html.escape(ver)}</h2>{tag}{when}</div>
      <ul>
{items_html(items, 8)}
      </ul>
    </article>""")
    body = f"""  <main class="sub">
    <div class="head">
      <p class="eyebrow">Änderungen</p>
      <h1>Was sich in Pump Paper geändert hat.</h1>
      <p class="lede">Jede neue Version landet automatisch hier und als Zip im Download. Aktuell ist {html.escape(version)}.</p>
      <div class="cta"><a class="btn gold" href="{DOWNLOAD}">Zip {html.escape(version)} herunterladen</a></div>
    </div>
{chr(10).join(entries)}
  </main>"""
    (SITE / "changelog.html").write_text(
        page("changelog", "Pump Paper Änderungen", f"Alle Versionen von Pump Paper, aktuell {version}.", body), encoding="utf-8")

    index = (SITE / "index.html").read_text(encoding="utf-8")
    index = replace_marker(index, "version", version)
    latest = versions[0][2][:4] if versions else []
    index = replace_marker(index, "latest", "\n" + items_html(latest, 10) + "\n          ")
    index = replace_marker(index, "nav", "\n    " + nav(home=True) + "\n    ")
    (SITE / "index.html").write_text(index, encoding="utf-8")
    print(f"Website gebaut: Version {version}, {len(versions)} Versionen im Änderungsprotokoll")


if __name__ == "__main__":
    main()
