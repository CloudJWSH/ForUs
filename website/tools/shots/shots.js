// Erzeugt die Bilder der Erweiterung für die Website aus dem echten Code in extension/.
// Aufruf: node website/tools/shots/shots.js  (braucht playwright)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../../..");
const EXT = path.join(ROOT, "extension");
const OUT = path.join(ROOT, "website/assets/shots");
const MOCK = fs.readFileSync(path.join(__dirname, "mock.js"), "utf8");
const SUNNY = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  const ctx = await b.newContext({deviceScaleFactor: 2, colorScheme: "dark"});
  await ctx.addInitScript(MOCK);
  await ctx.route("https://pump.fun/**", async route => {
    const url = new URL(route.request().url());
    const file = path.join(EXT, path.basename(url.pathname));
    if (url.pathname.endsWith(".js") || url.pathname.endsWith(".html")) {
      const type = url.pathname.endsWith(".js") ? "text/javascript" : "text/html";
      return route.fulfill({contentType: type + "; charset=utf-8", body: fs.readFileSync(file, "utf8")});
    }
    return route.fulfill({contentType: "text/html", body:
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#15161b;width:100vw;height:100vh">
       <script src="/ext/price.js"></script><script src="/ext/content.js"></script></body></html>`});
  });

  const panel = await ctx.newPage();
  await panel.setViewportSize({width: 360, height: 760});
  await panel.goto(`https://pump.fun/coin/${SUNNY}`);
  await panel.waitForTimeout(1500);
  const box = await panel.evaluate(() => {
    const host = [...document.documentElement.children].find(e => e.shadowRoot);
    const r = host.shadowRoot.getElementById("box").getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
  });
  await panel.screenshot({path: path.join(OUT, "panel.png"), clip: box, omitBackground: true});

  for (const tab of ["konto", "verlauf"]) {
    const p = await ctx.newPage();
    await p.setViewportSize({width: 380, height: 600});
    await p.goto(`https://pump.fun/ext/popup.html`);
    await p.waitForTimeout(800);
    if (tab !== "konto") await p.click(`nav button[data-tab="${tab}"]`);
    await p.waitForTimeout(300);
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.screenshot({path: path.join(OUT, `fenster-${tab}.png`), clip: {x: 0, y: 0, width: 380, height: Math.min(h, 640)}});
  }
  await b.close();
  console.log("Bilder in", OUT);
})();
