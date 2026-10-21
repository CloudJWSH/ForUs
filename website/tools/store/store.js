// Erzeugt die Bilder für den Chrome Web Store in website/store/ aus frame.html und den Bildern in assets/shots.
// Aufruf: node website/tools/store/store.js  (braucht playwright)
const path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "website/store");
const FRAME = "file://" + path.join(__dirname, "frame.html");
const JOBS = [
  ["panel", 1280, 800], ["echt", 1280, 800], ["konto", 1280, 800], ["verlauf", 1280, 800],
  ["tile", 440, 280], ["marquee", 1400, 560],
];

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  for (const lang of ["de", "en"]) {
    for (const [kind, w, h] of JOBS) {
      const p = await b.newPage({viewport: {width: w, height: h}});
      await p.goto(`${FRAME}#${kind}-${lang}`);
      await p.waitForTimeout(1200);
      await p.screenshot({path: path.join(OUT, `${kind}-${lang}.png`)});
      await p.close();
    }
  }
  await b.close();
  console.log("Store-Bilder in", OUT);
})();
