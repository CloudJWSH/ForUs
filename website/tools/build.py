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

Platzhalter im Inhalt: {{version}}, {{download}}, {{date}}.

Coin: website/coin.json steuert den Abschnitt über den Pump-Paper-Coin auf pump.fun (Marker <!-- coin --> und
<!-- coin-badge --> auf der Startseite), die eigene Seite coin.html (Teilen-Bild assets/og-coin.png aus tools/og-coin.html)
und den $PAPER-Link im Menü. Solange "live" false ist, bleibt alles leer und coin.html wird gelöscht. --coin-preview zeigt ihn zum
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
    {"de": "strategie", "en": "strategy"},
    {"de": "datenschutz", "en": "privacy"},
    {"de": "changelog", "en": "changelog"},
    {"de": "coin", "en": "coin"},
    {"de": "404", "en": "404"},
]

LANGS = {
    "de": {
        "dir": SITE, "up": "", "other": "en", "other_dir": "en/", "switch": "EN", "switch_label": "English",
        "nav": [("index.html#rechnung", "So rechnet es", "index"), ("anleitung.html", "Anleitung", "anleitung"),
                ("lexikon.html", "Lexikon", "lexikon"), ("konto.html", "Konto", "konto"),
                ("strategie.html", "Labor", "strategie"),
                ("index.html#fragen", "Fragen", "index")],
        "get": "Holen", "menu": "Menü", "skip": "Zum Inhalt springen", "install": "#installieren", "nav_label": "Seite", "foot_label": "Weitere Seiten",
        "foot": [("anleitung.html", "Anleitung"), ("lexikon.html", "Lexikon"), ("ueben.html", "Üben"), ("konto.html", "Konto"), ("strategie.html", "Strategie-Labor"),
                 ("changelog.html", "Änderungen"), ("datenschutz.html", "Datenschutz"), (SOURCE, "Quellcode")],
        "note": "Papertrading mit Spielgeld. Kein echtes Geld, keine Anlageberatung. Pump Paper ist ein unabhängiges Projekt und gehört nicht zu pump.fun.",
    },
    "en": {
        "dir": SITE / "en", "up": "../", "other": "de", "other_dir": "../", "switch": "DE", "switch_label": "Deutsch",
        "nav": [("index.html#math", "How it works", "index"), ("guide.html", "Guide", "guide"),
                ("glossary.html", "Glossary", "glossary"), ("account.html", "Account", "account"),
                ("strategy.html", "Lab", "strategy"),
                ("index.html#faq", "FAQ", "index")],
        "get": "Get it", "menu": "Menu", "skip": "Skip to content", "install": "#install", "nav_label": "Site", "foot_label": "More pages",
        "foot": [("guide.html", "Guide"), ("glossary.html", "Glossary"), ("practice.html", "Practice"), ("account.html", "Account"), ("strategy.html", "Strategy lab"),
                 ("changelog.html", "Changes"), ("privacy.html", "Privacy"), (SOURCE, "Source code")],
        "note": "Paper trading with play money. No real money, no financial advice. Pump Paper is an independent project and not affiliated with pump.fun.",
    },
}

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f2b33d"/>'
        '<path d="M7 21.5l6.5-6.5 4.5 4.5L25 11" fill="none" stroke="#1a1304" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>')


HOME = {
    "de": ("Pump Paper", "Pump Paper: Papertrading direkt auf pump.fun. Kaufen und verkaufen mit Spielgeld, gerechnet auf der echten Bonding-Kurve oder dem Pool, in SOL und USDC. Kein Wallet, kein Risiko.",
           "Papertrading direkt auf pump.fun: Spielgeld, echte Bonding-Kurve, echte Gebühren."),
    "en": ("Pump Paper", "Pump Paper: paper trading right on pump.fun. Buy and sell with play money, priced on the real bonding curve or pool, in SOL and USDC. No wallet, no risk.",
           "Paper trading right on pump.fun: play money, real bonding curve, real fees."),
}
LOCALE = {"de": "de_DE", "en": "en_US"}


def site_config():
    path = SITE / "site.json"
    cfg = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    base = cfg.get("base_url", "").strip()
    return {"base_url": base.rstrip("/") + "/" if base else ""}


CONFIG = site_config()
COIN = {}  # coin.json, wird in main() gesetzt


def page_url(lang, name):
    return ("" if lang == "de" else "en/") + name + ".html"


def head_meta(lang, name, title, description, og_description=None, image="og.png"):
    """Gemeinsamer Kopf aller Seiten: Beschreibung, Teilen-Vorschau, Icons, Farben, Sprachversion."""
    L, up, base = LANGS[lang], LANGS[lang]["up"], CONFIG["base_url"]
    og_d = og_description or description
    img = (base if base else up) + "assets/" + image
    e = html.escape
    lines = [
        f'<meta name="description" content="{e(description)}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Pump Paper">',
        f'<meta property="og:locale" content="{LOCALE[lang]}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(og_d)}">',
        f'<meta property="og:image" content="{img}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(title)}">',
        f'<meta name="twitter:description" content="{e(og_d)}">',
        '<meta name="color-scheme" content="dark light">',
        '<meta name="theme-color" content="#0b110f" media="(prefers-color-scheme: dark)">',
        '<meta name="theme-color" content="#f3f5f2" media="(prefers-color-scheme: light)">',
        f'<link rel="alternate" hreflang="{L["other"]}" href="{counterpart(lang, name)}">',
        f'<link rel="icon" href="{up}icons/icon.svg" type="image/svg+xml">',
        f'<link rel="icon" href="{up}icons/48.png" sizes="48x48">',
        f'<link rel="apple-touch-icon" href="{up}icons/180.png">',
        f'<link rel="manifest" href="{up}manifest.webmanifest">',
        '<script>try{var t=localStorage.getItem("pp-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>',
        f'<script src="{up}assets/site.js" defer></script>',
    ]
    if base:
        own = base + page_url(lang, name)
        lines += [f'<link rel="canonical" href="{own}">', f'<meta property="og:url" content="{own}">']
    return "\n".join(lines)


def bust(text, version):
    """CSS und JS mit ?v=Version, damit Browser nach einem Update nicht die alte Datei nehmen."""
    return re.sub(r'((?:\.\./)?assets/[\w.-]+\.(?:css|js))(?:\?v=[^"]*)?"', rf'\1?v={version}"', text)


def tables(text):
    """Spaltenköpfe für Screenreader als solche kennzeichnen."""
    return re.sub(r"<thead>(.*?)</thead>",
                  lambda m: "<thead>" + m.group(1).replace("<th>", '<th scope="col">') + "</thead>", text, flags=re.S)


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
    if COIN.get("live"):
        cur = ' aria-current="page"' if current == "coin" else ""
        links.append(f'<a class="nav-coin" href="coin.html"{cur}>${html.escape(COIN.get("symbol", "PAPER"))}</a>')
    links.append(f'<a class="lang" href="{counterpart(lang, current)}" hreflang="{L["other"]}" '
                 f'lang="{L["other"]}" aria-label="{L["switch_label"]}">{L["switch"]}</a>')
    get = L["install"] if home else "index.html" + L["install"]
    # Auf dem Handy sind die Links ausgeblendet, dort öffnet das Menü dieselben Links (ohne JavaScript).
    menu = "".join(l for l in links if 'class="lang"' not in l)
    theme = ('<button type="button" class="theme-btn" data-theme-toggle><svg viewBox="0 0 20 20" aria-hidden="true">'
             '<g class="sun" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.5"/>'
             '<path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"/></g>'
             '<path class="moon" d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
             '</svg></button>')
    return (f'<nav aria-label="{L["nav_label"]}">\n      ' + "\n      ".join(links) + "\n    </nav>\n"
            f'    {theme}\n'
            f'    <a class="btn gold small" href="{get}">{L["get"]}</a>\n'
            f'    <details class="menu"><summary aria-label="{L["menu"]}"><svg viewBox="0 0 20 20" aria-hidden="true">'
            f'<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></summary>'
            f'<div class="menu-panel">{menu}</div></details>')


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


MAIN_ID = re.compile(r"<main(?![^>]*\bid=)")


def page(lang, name, title, description, body, image="og.png"):
    up = LANGS[lang]["up"]
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
{head_meta(lang, name, title, description, image=image)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="{up}assets/site.css">
</head>
<body>
<a class="skip" href="#inhalt">{LANGS[lang]["skip"]}</a>
<div class="wrap">
  <header class="top">
    <a class="brand" href="index.html">
      {LOGO}
      Pump Paper
    </a>
    {nav(lang, name)}
  </header>
{MAIN_ID.sub('<main id="inhalt"', body.rstrip(), count=1)}
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
        "curve": "Bonding-Kurve", "curveNote": "geschätzt aus dem Bestand der Kurve", "supply": "Umlauf", "age": "Seit Launch",
        "fakeH": "Nur diese Mint ist echt.",
        "fake": "Auf pump.fun kann jeder einen Coin mit gleichem Namen und Bild starten. Echt ist nur die Mint-Adresse oben, die auch im Quellcode dieser Seite auf GitHub steht. Adressen aus Kommentaren, Chats oder Direktnachrichten sind Fälschungen. Wir schreiben niemanden zuerst an und fragen nie nach Wallet oder Seed.",
        "checkH": "Prüfen statt glauben",
        "check": ["Mint-Adresse kopieren und auf pump.fun oder Solscan einfügen, nicht nach dem Namen suchen.",
                  "Auf Solscan die Dev-Wallet öffnen: Bestand und jeder Verkauf sind öffentlich.",
                  "Die größten Konten ansehen. Eines davon ist die Bonding-Kurve oder der Pool, das ist normal.",
                  "Die Zahlen auf dieser Seite kommen direkt von der Blockchain und DexScreener, nicht von uns."],
        "legalH": "Rechtliches", "more": "Alles zum Coin auf einer Seite",
        "title": "${sym} auf pump.fun · Pump Paper",
        "desc": "Der Pump-Paper-Coin ${sym} auf pump.fun: Mint-Adresse, Dev-Wallet, Creator-Gebühr und Zahlen live zum Nachprüfen. Kein Anteil, keine Rendite.",
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
        "curve": "Bonding curve", "curveNote": "estimated from the curve's balance", "supply": "Supply", "age": "Since launch",
        "fakeH": "Only this mint is real.",
        "fake": "Anyone can launch a coin with the same name and picture on pump.fun. Only the mint address above is real, and it is also in this page's source on GitHub. Addresses from comments, chats or direct messages are fakes. We never message anyone first and never ask for a wallet or seed phrase.",
        "checkH": "Check, don't trust",
        "check": ["Copy the mint address and paste it into pump.fun or Solscan instead of searching by name.",
                  "Open the dev wallet on Solscan: its balance and every sale are public.",
                  "Look at the largest accounts. One of them is the bonding curve or the pool, that is normal.",
                  "The numbers on this page come straight from the blockchain and DexScreener, not from us."],
        "legalH": "Legal", "more": "Everything about the coin on one page",
        "title": "${sym} on pump.fun · Pump Paper",
        "desc": "The Pump Paper coin ${sym} on pump.fun: mint address, dev wallet, creator fee and live numbers to check. No share, no returns.",
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


def coin_html(lang, cfg, standalone=False):
    """Abschnitt und Hinweis oben im Hero, leer solange der Coin nicht live ist. standalone: für coin.html."""
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
    launched = html.escape(cfg.get("launched", ""))
    legal = html.escape(cfg.get("legal", {}).get(lang, ""))
    steps = "".join(f"<li>{html.escape(x)}</li>" for x in T["check"])
    extra = f"""
    <div class="coin-trust">
      <div class="coin-fake"><h3>{T["fakeH"]}</h3><p>{T["fake"]}</p></div>
      <div class="coin-check"><h3>{T["checkH"]}</h3><ol>{steps}</ol></div>
    </div>""" + (f'\n    <div class="coin-legal"><h3>{T["legalH"]}</h3><p>{legal}</p></div>' if legal else "")
    more = "" if standalone else f'\n    <p class="coin-more"><a href="coin.html">{T["more"]} →</a></p>'
    tag, close = ("h1", "h1") if standalone else ("h2", "h2")
    stat = lambda key, label, sub="": (f'<div><span class="k">{label}</span><b data-{key}>{T["loading"]}</b>'
                                       + (f"<small>{sub}</small>" if sub else "") + "</div>")
    section = f"""  <section class="block coin-sec" id="{anchor}">{note}
    <div class="head">
      <p class="eyebrow">{T["eyebrow"]}</p>
      <{tag}>{T["h2"].replace("${sym}", "$" + sym)}</{close}>
      <p class="lede">{T["lede"]}</p>
    </div>
    <div class="coin-grid" id="coin-live" data-mint="{mint}" data-dev="{dev}" data-symbol="{sym}" data-launched="{launched}">
      <div class="coin-card">
        <div class="coin-id"><img src="{up}icons/128.png" width="56" height="56" alt="Logo"><div><b>{html.escape(cfg.get("name", "Pump Paper"))}</b><span>${sym}</span></div></div>
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
          {stat("curve", T["curve"], T["curveNote"])}
          {stat("supply", T["supply"])}
          {stat("age", T["age"]) if launched else ""}
        </div>
        <div class="coin-not"><h3>{T["notH"]}</h3><ul>{facts}</ul></div>
        <p class="coin-risk">{T["risk"]}</p>
      </div>
    </div>{extra}{more}
  </section>
  <script src="{up}assets/coin.js"></script>
  """
    return section, badge


def coin_page(lang, cfg):
    """Eigene Seite coin.html, nur solange der Coin live ist; sonst wird sie gelöscht."""
    path = LANGS[lang]["dir"] / "coin.html"
    if not cfg.get("live"):
        if path.exists():
            path.unlink()
        return
    T, sym = COIN_TEXT[lang], "$" + cfg.get("symbol", "PAPER")
    section, _ = coin_html(lang, cfg, standalone=True)
    body = f'  <main class="sub coin-page">\n{section}\n  </main>'
    path.write_text(page(lang, "coin", T["title"].replace("${sym}", sym), T["desc"].replace("${sym}", sym), body,
                         image="og-coin.png"), encoding="utf-8")


def structured(lang, index, version):
    """Strukturierte Daten für Suchmaschinen: die Erweiterung und die Fragen der Startseite."""
    strip = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()
    faq = [{"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}}
           for q, a in re.findall(r"<details[^>]*><summary>(.*?)</summary><p>(.*?)</p></details>", index, re.S)]
    app = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Pump Paper",
           "applicationCategory": "FinanceApplication", "operatingSystem": "Chrome", "softwareVersion": version,
           "inLanguage": lang, "description": HOME[lang][1], "downloadUrl": DOWNLOAD,
           "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}}
    data = [app] + ([{"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq}] if faq else [])
    return "\n".join('<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False).replace("</", "<\\/") + "</script>" for d in data)


def webp():
    """Screenshots zusätzlich als WebP (deutlich kleiner). Ohne Pillow bleibt es bei PNG."""
    try:
        from PIL import Image
    except ImportError:
        return
    for png in (SITE / "assets" / "shots").glob("*.png"):
        out = png.with_suffix(".webp")
        if not out.exists() or out.stat().st_mtime < png.stat().st_mtime:
            Image.open(png).save(out, "WEBP", quality=88, method=6)


def pictures(text):
    """<img> der Screenshots in <picture> mit WebP verpacken, sofern die WebP-Datei da ist; alle Bilder laden asynchron."""
    # Erst vorhandene Hüllen entfernen (auch doppelte), dann neu verpacken. So bleibt der Lauf wiederholbar.
    unwrap = re.compile(r'<picture><source srcset="[^"]+" type="image/webp">(<img[^>]*>)</picture>')
    while unwrap.search(text):
        text = unwrap.sub(r"\1", text)

    def wrap(m):
        tag, src = m.group(0), m.group(2)
        webp_path = (SITE / re.sub(r"^(\.\./)+", "", src)).with_suffix(".webp")
        if not webp_path.exists():
            return tag
        return f'<picture><source srcset="{src[:-4]}.webp" type="image/webp">{tag}</picture>'
    text = re.sub(r'<img([^>]*?) src="((?:\.\./)?assets/shots/[\w-]+\.png)"[^>]*>', wrap, text)
    return re.sub(r"<img(?![^>]*decoding=)", '<img decoding="async"', text)


def finish(version):
    """Nacharbeit für alle fertigen Seiten und die Dateien drumherum (robots, Sitemap, Manifest)."""
    webp()
    pages = []
    for lang in LANGS:
        for path in sorted(LANGS[lang]["dir"].glob("*.html")):
            text = path.read_text(encoding="utf-8")
            new = pictures(tables(bust(text, version)))
            if new != text:
                path.write_text(new, encoding="utf-8")
            if path.stem != "404":
                pages.append(page_url(lang, path.stem))
    base = CONFIG["base_url"]
    robots = "User-agent: *\nAllow: /\n" + (f"Sitemap: {base}sitemap.xml\n" if base else "")
    (SITE / "robots.txt").write_text(robots, encoding="utf-8")
    sitemap = SITE / "sitemap.xml"
    if base:
        urls = "".join(f"  <url><loc>{base}{p}</loc></url>\n" for p in pages)
        sitemap.write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                           f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding="utf-8")
    elif sitemap.exists():
        sitemap.unlink()


def changelog(name="CHANGELOG.md"):
    text = (EXT / name).read_text(encoding="utf-8")
    versions = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        head, *lines = block.splitlines()
        items = [l[2:].strip() for l in lines if l.startswith("- ")]
        ver, _, date = head.partition("·")
        versions.append((ver.strip(), date.strip(), items))
    return versions


def nice_date(iso, lang):
    """2026-10-21 oder 21.10.2026 → 21.10.2026 bzw. Oct 21, 2026."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    m2 = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", iso or "")
    if m:
        y, mo, d = m.groups()
    elif m2:
        d, mo, y = m2.groups()
    else:
        return iso or "–"
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{int(d)}.{int(mo)}.{y}" if lang == "de" else f"{months[int(mo) - 1]} {int(d)}, {y}"


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


def build_sources(lang, version, date=""):
    src_dir = SITE / "src" / ("" if lang == "de" else lang)
    out = LANGS[lang]["dir"]
    for src in sorted(src_dir.glob("*.html")):
        raw = src.read_text(encoding="utf-8")
        title = re.search(r"<!-- title: (.*?) -->", raw).group(1)
        desc = re.search(r"<!-- description: (.*?) -->", raw).group(1)
        body = re.sub(r"<!-- (title|description): .*? -->\n?", "", raw)
        body = body.replace("{{version}}", version).replace("{{download}}", DOWNLOAD).replace("{{date}}", nice_date(date, lang))
        out.mkdir(exist_ok=True)
        (out / src.name).write_text(page(lang, src.stem, title, desc, body), encoding="utf-8")


def main():
    coin = coin_config("--coin-preview" in sys.argv)
    COIN.update(coin)
    version = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))["version"]
    versions = changelog()

    for lang in LANGS:
        build_sources(lang, version, versions[0][1] if versions else "")

    texts = {
        "de": ("CHANGELOG.md", "Neu", "Änderungen", "Was sich in Pump Paper geändert hat.",
               "Jede neue Version landet automatisch hier und als Zip im Download. Aktuell ist {v}.",
               "Zip {v} herunterladen", "Pump Paper Änderungen", "Alle Versionen von Pump Paper, aktuell {v}."),
        "en": ("CHANGELOG.en.md", "New", "Changes", "What changed in Pump Paper.",
               "Every new version shows up here and as a zip download automatically. Current version: {v}.",
               "Download zip {v}", "Pump Paper Changes", "Every version of Pump Paper, currently {v}."),
    }
    for lang, (file, new, eyebrow, h1, lede, btn, title, desc) in texts.items():
        link_label = "Link zu Version" if lang == "de" else "Link to version"
        feed = ("Neue Versionen abonnieren (Feed)" if lang == "de" else "Subscribe to new versions (feed)")
        if not (EXT / file).exists():
            continue
        entries = []
        for i, (ver, date, items) in enumerate(changelog(file)):
            tag = f'<span class="st">{new}</span>' if i == 0 else ""
            when = f'<span class="when">{html.escape(date)}</span>' if date else ""
            entries.append(f"""    <article class="release" id="v{html.escape(ver)}">
      <div class="release-head"><h2>{html.escape(ver)}</h2>{tag}{when}<a class="anchor" href="#v{html.escape(ver)}" data-copy-link aria-label="{link_label} {html.escape(ver)}">#</a></div>
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
      <div class="cta"><a class="btn gold" href="{DOWNLOAD}">{btn.format(v=v)}</a><a class="btn" href="{SOURCE}/releases.atom">{feed}</a></div>
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
        index = replace_marker(index, "date", nice_date(own[0][1], lang) if own else "–", required=False)
        index = replace_marker(index, "latest", "\n" + items_html(latest, 10) + "\n          ", required=False)
        index = replace_marker(index, "nav", "\n    " + nav(lang, "index", home=True) + "\n    ")
        index = replace_marker(index, "footer", "\n  " + footer(lang) + "\n  ")
        title, desc, og = HOME[lang]
        index = replace_marker(index, "meta", "\n" + head_meta(lang, "index", title, desc, og) + "\n" + structured(lang, index, version) + "\n",
                               required=False)
        section, badge = coin_html(lang, coin)
        index = replace_marker(index, "coin", ("\n" + section) if section else "", required=False)
        index = replace_marker(index, "coin-badge", badge, required=False)
        path.write_text(index, encoding="utf-8")
        coin_page(lang, coin)
    finish(version)
    print(f"Website gebaut: Version {version}, {len(versions)} Versionen im Änderungsprotokoll")


if __name__ == "__main__":
    main()
