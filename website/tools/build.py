"""Baut die Unterseiten der Pump-Paper-Website und trägt Version und Neuerungen ein.

Quellen:
  website/src/*.html        Inhalt je deutscher Unterseite, Kopf mit <!-- title: … --> und <!-- description: … -->
  website/src/en/*.html     dasselbe auf Englisch, Ergebnis landet in website/en/
  extension/manifest.json   aktuelle Version
  extension/CHANGELOG.md    Änderungen je Version (## <Version> · <Datum>, darunter Zeilen mit "- ")
  extension/CHANGELOG.en.md dasselbe auf Englisch für en/changelog.html

Ergebnis:
  website/<name>.html, website/en/<name>.html   Unterseiten mit gemeinsamem Kopf und Fuß
  website/changelog.html                        Änderungsprotokoll
  website/index.html, website/en/index.html     Navigation, Version und Neuerungen zwischen den Markern

Platzhalter im Inhalt: {{version}}, {{download}}.
Aufruf: python3 website/tools/build.py (läuft auch in den Workflows).
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "website"
EXT = ROOT / "extension"
DOWNLOAD = "https://github.com/CloudJWSH/ForUs/releases/latest/download/Pump-Paper.zip"
SOURCE = "https://github.com/CloudJWSH/ForUs"

# Seitenname je Sprache: gleiche Zeile = dieselbe Seite, für den Sprachumschalter.
PAGES = [
    {"de": "index", "en": "index"},
    {"de": "anleitung", "en": "guide"},
    {"de": "lexikon", "en": "glossary"},
    {"de": "ueben", "en": "practice"},
    {"de": "konto", "en": "account"},
    {"de": "datenschutz", "en": "privacy"},
    {"de": "changelog", "en": "changelog"},
    {"de": "404", "en": "404"},
]

LANGS = {
    "de": {
        "dir": SITE, "up": "", "other": "en", "other_dir": "en/", "switch": "EN", "switch_label": "English",
        "nav": [("index.html#rechnung", "So rechnet es", "index"), ("anleitung.html", "Anleitung", "anleitung"),
                ("lexikon.html", "Lexikon", "lexikon"), ("konto.html", "Konto", "konto"),
                ("index.html#fragen", "Fragen", "index")],
        "get": "Holen", "install": "#installieren", "nav_label": "Seite", "foot_label": "Weitere Seiten",
        "foot": [("anleitung.html", "Anleitung"), ("lexikon.html", "Lexikon"), ("ueben.html", "Üben"), ("konto.html", "Konto"),
                 ("changelog.html", "Änderungen"), ("datenschutz.html", "Datenschutz"), (SOURCE, "Quellcode")],
        "note": "Papertrading mit Spielgeld. Kein echtes Geld, keine Anlageberatung. Pump Paper ist ein unabhängiges Projekt und gehört nicht zu pump.fun.",
    },
    "en": {
        "dir": SITE / "en", "up": "../", "other": "de", "other_dir": "../", "switch": "DE", "switch_label": "Deutsch",
        "nav": [("index.html#math", "How it works", "index"), ("guide.html", "Guide", "guide"),
                ("glossary.html", "Glossary", "glossary"), ("account.html", "Account", "account"),
                ("index.html#faq", "FAQ", "index")],
        "get": "Get it", "install": "#install", "nav_label": "Site", "foot_label": "More pages",
        "foot": [("guide.html", "Guide"), ("glossary.html", "Glossary"), ("practice.html", "Practice"), ("account.html", "Account"),
                 ("changelog.html", "Changes"), ("privacy.html", "Privacy"), (SOURCE, "Source code")],
        "note": "Paper trading with play money. No real money, no financial advice. Pump Paper is an independent project and not affiliated with pump.fun.",
    },
}

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f2b33d"/>'
        '<path d="M7 21.5l6.5-6.5 4.5 4.5L25 11" fill="none" stroke="#1a1304" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>')


def counterpart(lang, name):
    """Link zur gleichen Seite in der anderen Sprache, sonst zur Startseite."""
    L = LANGS[lang]
    for row in PAGES:
        if row[lang] == name and row[L["other"]]:
            return L["other_dir"] + row[L["other"]] + ".html"
    return L["other_dir"] + "index.html"


def nav(lang, current, home=False):
    L = LANGS[lang]
    links = []
    for href, label, key in L["nav"]:
        anchor = "#" in href
        if home and href.startswith("index.html#"):
            href = href[len("index.html"):]
        cur = ' aria-current="page"' if key == current and not anchor else ""
        links.append(f'<a href="{href}"{cur}>{label}</a>')
    links.append(f'<a class="lang" href="{counterpart(lang, current)}" hreflang="{L["other"]}" '
                 f'lang="{L["other"]}" aria-label="{L["switch_label"]}">{L["switch"]}</a>')
    get = L["install"] if home else "index.html" + L["install"]
    return (f'<nav aria-label="{L["nav_label"]}">\n      ' + "\n      ".join(links) + "\n    </nav>\n"
            f'    <a class="btn gold small" href="{get}">{L["get"]}</a>')


def footer(lang):
    L = LANGS[lang]
    links = "".join(f'<a href="{h}">{t}</a>' for h, t in L["foot"])
    return f"""<footer>
    <a class="brand" href="index.html">
      {LOGO}
      Pump Paper
    </a>
    <p>{L["note"]}</p>
    <nav class="foot-nav" aria-label="{L["foot_label"]}">{links}</nav>
  </footer>"""


def page(lang, name, title, description, body):
    up = LANGS[lang]["up"]
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:image" content="{up}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" hreflang="{LANGS[lang]["other"]}" href="{counterpart(lang, name)}">
<link rel="icon" href="{up}icons/48.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="{up}assets/site.css">
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="index.html">
      {LOGO}
      Pump Paper
    </a>
    {nav(lang, name)}
  </header>
{body.rstrip()}
  {footer(lang)}
</div>
</body>
</html>
"""


def changelog(name="CHANGELOG.md"):
    text = (EXT / name).read_text(encoding="utf-8")
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


def replace_marker(text, name, value, required=True):
    pattern = re.compile(rf"(<!-- {name} -->)(.*?)(<!-- /{name} -->)", re.S)
    if not pattern.search(text):
        if required:
            raise SystemExit(f"Marker {name} fehlt")
        return text
    return pattern.sub(lambda m: m.group(1) + value + m.group(3), text)


def build_sources(lang, version):
    src_dir = SITE / "src" / ("" if lang == "de" else lang)
    out = LANGS[lang]["dir"]
    for src in sorted(src_dir.glob("*.html")):
        raw = src.read_text(encoding="utf-8")
        title = re.search(r"<!-- title: (.*?) -->", raw).group(1)
        desc = re.search(r"<!-- description: (.*?) -->", raw).group(1)
        body = re.sub(r"<!-- (title|description): .*? -->\n?", "", raw)
        body = body.replace("{{version}}", version).replace("{{download}}", DOWNLOAD)
        out.mkdir(exist_ok=True)
        (out / src.name).write_text(page(lang, src.stem, title, desc, body), encoding="utf-8")


def main():
    version = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))["version"]
    versions = changelog()

    for lang in LANGS:
        build_sources(lang, version)

    texts = {
        "de": ("CHANGELOG.md", "Neu", "Änderungen", "Was sich in Pump Paper geändert hat.",
               "Jede neue Version landet automatisch hier und als Zip im Download. Aktuell ist {v}.",
               "Zip {v} herunterladen", "Pump Paper Änderungen", "Alle Versionen von Pump Paper, aktuell {v}."),
        "en": ("CHANGELOG.en.md", "New", "Changes", "What changed in Pump Paper.",
               "Every new version shows up here and as a zip download automatically. Current version: {v}.",
               "Download zip {v}", "Pump Paper Changes", "Every version of Pump Paper, currently {v}."),
    }
    for lang, (file, new, eyebrow, h1, lede, btn, title, desc) in texts.items():
        if not (EXT / file).exists():
            continue
        entries = []
        for i, (ver, date, items) in enumerate(changelog(file)):
            tag = f'<span class="st">{new}</span>' if i == 0 else ""
            when = f'<span class="when">{html.escape(date)}</span>' if date else ""
            entries.append(f"""    <article class="release" id="v{html.escape(ver)}">
      <div class="release-head"><h2>{html.escape(ver)}</h2>{tag}{when}</div>
      <ul>
{items_html(items, 8)}
      </ul>
    </article>""")
        v = html.escape(version)
        body = f"""  <main class="sub">
    <div class="head">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{h1}</h1>
      <p class="lede">{lede.format(v=v)}</p>
      <div class="cta"><a class="btn gold" href="{DOWNLOAD}">{btn.format(v=v)}</a></div>
    </div>
{chr(10).join(entries)}
  </main>"""
        (LANGS[lang]["dir"] / "changelog.html").write_text(
            page(lang, "changelog", title, desc.format(v=version), body), encoding="utf-8")

    for lang in LANGS:
        file = texts[lang][0] if (EXT / texts[lang][0]).exists() else "CHANGELOG.md"
        own = changelog(file)
        latest = own[0][2][:4] if own else []
        path = LANGS[lang]["dir"] / "index.html"
        if not path.exists():
            continue
        index = path.read_text(encoding="utf-8")
        index = replace_marker(index, "version", version)
        index = replace_marker(index, "latest", "\n" + items_html(latest, 10) + "\n          ", required=False)
        index = replace_marker(index, "nav", "\n    " + nav(lang, "index", home=True) + "\n    ")
        path.write_text(index, encoding="utf-8")
    print(f"Website gebaut: Version {version}, {len(versions)} Versionen im Änderungsprotokoll")


if __name__ == "__main__":
    main()
