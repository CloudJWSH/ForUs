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

Coin: website/coin.json steuert den Abschnitt über den Pump-Paper-Coin auf pump.fun (Marker <!-- coin --> und
<!-- coin-badge --> auf der Startseite). Solange "live" false ist, bleibt er leer. --coin-preview zeigt ihn zum
Ansehen trotzdem, mit Platzhaltern; danach normal bauen, damit nichts davon eingecheckt wird.

Aufruf: python3 website/tools/build.py [--coin-preview] (läuft auch in den Workflows).
"""
import html
import json
import re
import sys
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


COIN_TEXT = {
    "de": {
        "badge": "${sym} ist live auf pump.fun", "eyebrow": "Der Coin", "h2": "${sym} auf pump.fun.",
        "lede": "Pump Paper gibt es auch als Coin auf pump.fun. Hier stehen alle Adressen und Zahlen zum Nachprüfen, live aus der Blockchain.",
        "mint": "Mint-Adresse", "copy": "Kopieren", "copied": "Kopiert", "dev": "Dev-Wallet", "fee": "Creator-Gebühr",
        "mc": "Marktwert", "where": "Handel", "devShare": "Anteil Dev-Wallet", "top": "Größte 10 Konten",
        "topNote": "einschließlich Bonding-Kurve oder Pool", "loading": "lädt …",
        "notH": "Was der Coin nicht ist",
        "risk": "<b>Risiko.</b> Ein Memecoin ohne Wertversprechen. Der Kurs kann jederzeit fallen, ein Totalverlust ist möglich. Das hier ist keine Anlageberatung und keine Aufforderung zum Kauf.",
        "preview": "Vorschau: Der Abschnitt ist ausgeschaltet, bis der Coin live ist. Adressen sind Platzhalter.",
    },
    "en": {
        "badge": "${sym} is live on pump.fun", "eyebrow": "The coin", "h2": "${sym} on pump.fun.",
        "lede": "Pump Paper also exists as a coin on pump.fun. Every address and number is here to check, live from the blockchain.",
        "mint": "Mint address", "copy": "Copy", "copied": "Copied", "dev": "Dev wallet", "fee": "Creator fee",
        "mc": "Market cap", "where": "Trading on", "devShare": "Dev wallet share", "top": "Largest 10 accounts",
        "topNote": "including bonding curve or pool", "loading": "loading …",
        "notH": "What the coin is not",
        "risk": "<b>Risk.</b> A memecoin with no promise of value. The price can drop at any time, a total loss is possible. This is not financial advice and not an invitation to buy.",
        "preview": "Preview: this section stays off until the coin is live. Addresses are placeholders.",
    },
}
PLACEHOLDER = "PAPERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxpump"


def coin_config(preview):
    path = SITE / "coin.json"
    cfg = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"live": False}
    if preview and not cfg.get("live"):
        cfg = {**cfg, "live": True, "preview": True,
               "mint": cfg.get("mint") or PLACEHOLDER, "dev_wallet": cfg.get("dev_wallet") or "DEVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
    if cfg.get("live") and not cfg.get("preview"):
        for key in ("mint", "dev_wallet"):
            if not re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", cfg.get(key, "")):
                raise SystemExit(f"coin.json: {key} ist keine gültige Solana-Adresse")
    return cfg


def coin_html(lang, cfg):
    """Abschnitt und Hinweis oben im Hero, leer solange der Coin nicht live ist."""
    if not cfg.get("live"):
        return "", ""
    T = COIN_TEXT[lang]
    sym = html.escape(cfg.get("symbol", "PAPER"))
    mint, dev = html.escape(cfg["mint"]), html.escape(cfg["dev_wallet"])
    up = LANGS[lang]["up"]
    anchor = "coin"
    badge = f'<a class="coin-badge" href="#{anchor}"><span class="dot"></span>{T["badge"].replace("${sym}", "$" + sym)}</a>'
    facts = "".join(f"<li>{html.escape(x)}</li>" for x in cfg.get("facts", {}).get(lang, []))
    fee = html.escape(cfg.get("creator_fee", {}).get(lang, ""))
    links = (f'<a class="btn gold small" href="https://pump.fun/coin/{mint}" rel="noopener">pump.fun</a>'
             f'<a class="btn small" href="https://solscan.io/token/{mint}" rel="noopener">Solscan</a>'
             f'<a class="btn small" href="https://dexscreener.com/solana/{mint}" rel="noopener">DexScreener</a>')
    note = f'\n    <p class="coin-preview">{T["preview"]}</p>' if cfg.get("preview") else ""
    stat = lambda key, label, sub="": (f'<div><span class="k">{label}</span><b data-{key}>{T["loading"]}</b>'
                                       + (f"<small>{sub}</small>" if sub else "") + "</div>")
    section = f"""  <section class="block coin-sec" id="{anchor}">{note}
    <div class="head">
      <p class="eyebrow">{T["eyebrow"]}</p>
      <h2>{T["h2"].replace("${sym}", "$" + sym)}</h2>
      <p class="lede">{T["lede"]}</p>
    </div>
    <div class="coin-grid" id="coin-live" data-mint="{mint}" data-dev="{dev}" data-symbol="{sym}">
      <div class="coin-card">
        <div class="coin-id"><img src="{up}icons/128.png" width="56" height="56" alt=""><div><b>{html.escape(cfg.get("name", "Pump Paper"))}</b><span>${sym}</span></div></div>
        <div class="addr"><span class="k">{T["mint"]}</span><code>{mint}</code><button type="button" class="k-link" data-copy="{mint}" data-done="{T["copied"]}">{T["copy"]}</button></div>
        <div class="addr"><span class="k">{T["dev"]}</span><code><a href="https://solscan.io/account/{dev}" rel="noopener">{dev}</a></code></div>
        <div class="addr"><span class="k">{T["fee"]}</span><p>{fee}</p></div>
        <div class="cta">{links}</div>
      </div>
      <div class="coin-side">
        <div class="coin-stats">
          {stat("mc", T["mc"])}
          {stat("where", T["where"])}
          {stat("dev-share", T["devShare"])}
          {stat("top", T["top"], T["topNote"])}
        </div>
        <div class="coin-not"><h3>{T["notH"]}</h3><ul>{facts}</ul></div>
        <p class="coin-risk">{T["risk"]}</p>
      </div>
    </div>
  </section>
  <script src="{up}assets/coin.js"></script>
  """
    return section, badge


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
    coin = coin_config("--coin-preview" in sys.argv)
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
        section, badge = coin_html(lang, coin)
        index = replace_marker(index, "coin", ("\n" + section) if section else "", required=False)
        index = replace_marker(index, "coin-badge", badge, required=False)
        path.write_text(index, encoding="utf-8")
    print(f"Website gebaut: Version {version}, {len(versions)} Versionen im Änderungsprotokoll")


if __name__ == "__main__":
    main()
