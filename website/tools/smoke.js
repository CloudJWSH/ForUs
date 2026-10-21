// Rauchtest im Browser: Rechner, Demo, Konto und Coin-freie Seiten laufen ohne Fehler und ohne seitliches Scrollen.
// Aufruf: node website/tools/smoke.js  (braucht das npm-Paket playwright; CHROMIUM=/pfad nimmt einen vorhandenen Browser)
const path = require("path");
const {chromium} = require("playwright");
const SITE = path.resolve(__dirname, "..");
const url = p => "file://" + path.join(SITE, p);
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  async function open(p, width = 1280) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    page.on("console", m => /Content Security Policy|Refused to/i.test(m.text()) && errs.push("CSP: " + m.text().slice(0, 160)));
    await page.route(/^https?:\/\//, r => r.abort());  // offline: Schriften und APIs dürfen fehlen
    await page.goto(url(p));
    return {page, errs};
  }

  for (const p of ["index.html", "en/index.html"]) {
    const {page, errs} = await open(p);
    // Rechner: andere Summe ergibt anderes Ergebnis
    const before = await page.textContent("#o-got");
    await page.fill("#r-amt", "2.5");
    await page.dispatchEvent("#r-amt", "input");
    await page.waitForTimeout(100);
    ok(before !== await page.textContent("#o-got"), `${p}: Rechner reagiert nicht`);
    ok(/\d/.test(await page.textContent("#o-be")), `${p}: Break-even fehlt`);
    await page.selectOption("#r-mode", "sell");
    ok(/SOL/.test(await page.textContent("#o-got")), `${p}: Verkauf im Rechner fehlt`);
    await page.selectOption("#r-mode", "buy");
    await page.fill("#r-slip", "300");
    await page.dispatchEvent("#r-slip", "input");
    ok(!/NaN/.test(await page.textContent("#rechner")) && await page.textContent("#o-got") === "–", `${p}: falsche Eingabe ohne Meldung`);
    await page.click("#rechner [type=reset]");
    await page.waitForTimeout(50);
    // Demo: Kaufen ändert den Kontostand
    await page.locator("#demo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const bal = await page.textContent("[data-bal]");
    await page.click("[data-buy='0.5']");
    await page.waitForTimeout(1500);  // die Demo wartet wie echt eine Sekunde auf die Bestätigung
    ok(bal !== await page.textContent("[data-bal]"), `${p}: Demo-Kauf ändert nichts`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  for (const p of ["konto.html", "en/account.html"]) {
    const {page, errs} = await open(p);
    await page.waitForTimeout(2600);  // ohne Erweiterung kommen nach 2 s die Beispieldaten
    ok((await page.locator("[data-body] tr, [data-body] .k-tile, [data-body] li").count()) > 3, `${p}: Beispielkonto fehlt`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  for (const p of ["strategie.html", "en/strategy.html"]) {
    const {page, errs} = await open(p);
    await page.waitForTimeout(400);
    ok(/\d/.test(await page.textContent("[data-result]")), `${p}: Labor zeigt kein Ergebnis`);
    const before = await page.textContent("[data-result]");
    await page.click("[data-template=streng]");
    await page.waitForTimeout(300);
    ok(before !== await page.textContent("[data-result]"), `${p}: Vorlage ändert nichts`);
    await page.fill("#l-stop", "300");
    await page.waitForTimeout(400);
    ok((await page.textContent("[data-errors]")).length > 0, `${p}: falscher Stop ohne Fehlermeldung`);
    // Geteilter Link öffnet genau diese Strategie
    const s = {format: "pump-paper-strategy", version: 1, name: "Rauchtest", entry: {mcUsd: {min: 0, max: 9000}}, size: {mode: "sol", value: 0.5}, exit: {targetPct: 30}};
    await page.goto(url(p) + "#s=" + Buffer.from(JSON.stringify(s)).toString("base64url"));
    await page.reload();  // nur der Anker ändert sich, die Seite muss neu laden
    await page.waitForTimeout(400);
    ok(await page.inputValue("#l-name") === "Rauchtest", `${p}: geteilter Link lädt die Strategie nicht`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  for (const p of ["grundlagen.html", "en/basics.html"]) {
    const {page, errs} = await open(p);
    await page.check("[name=q0][value='0']");
    await page.click("#quiz-form [type=submit]");
    const res = await page.textContent(".quiz-result");
    ok(/^\D*1\D+10/.test(res.trim()), `${p}: Quiz zählt falsch (${res.slice(0, 40)})`);
    ok((await page.locator(".quiz-result li a").count()) === 9, `${p}: Quiz verlinkt die falschen Antworten nicht`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  for (const p of ["lexikon.html", "en/glossary.html"]) {
    const {page, errs} = await open(p);
    ok((await page.locator(".glossary .see a").count()) > 40, `${p}: „Siehe auch“ fehlt`);
    await page.fill("#lex-q", "trailing");
    ok((await page.locator(".glossary > div:not([hidden])").count()) >= 1, `${p}: Suche findet Trailing Stop nicht`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  for (const p of ["ueben.html", "en/practice.html"]) {
    const {page, errs} = await open(p);
    await page.fill(".week textarea >> nth=0", "Rauchtest");
    await page.reload();
    ok(await page.inputValue(".week textarea >> nth=0") === "Rauchtest", `${p}: Notiz bleibt nicht`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  const pages = ["index.html", "anleitung.html", "lexikon.html", "ueben.html", "grundlagen.html", "konto.html", "strategie.html", "changelog.html", "datenschutz.html", "404.html",
                 "en/index.html", "en/guide.html", "en/glossary.html", "en/practice.html", "en/basics.html", "en/account.html", "en/strategy.html", "en/changelog.html", "en/privacy.html", "en/404.html"];
  for (const p of pages) {
    const {page, errs} = await open(p, 390);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 0, `${p}: ${over}px seitlich zu breit auf dem Handy`);
    ok(!errs.length, `${p}: Fehler ${errs.join(" | ")}`);
    await page.close();
  }

  await browser.close();
  fails.forEach(f => console.log(f));
  console.log(`Rauchtest: ${fails.length ? fails.length + " Fehler" : "alles in Ordnung"}`);
  process.exit(fails.length ? 1 : 0);
})();
