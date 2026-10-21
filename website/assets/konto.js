// Konto-Seite: liest dein Papier-Konto aus der installierten Erweiterung (ab 1.7) und wertet es aus.
// Nur lesend: die Seite fragt per postMessage {source: "pump-paper-site", type: "account"} und zeigt die Antwort.
// Ohne Erweiterung zeigt sie deutlich markierte Beispieldaten. Nichts davon verlässt den Browser.
(function () {
  const root = document.getElementById("konto");
  // Filter der Auswertung: Zeitraum, Verkaufsgrund, Zahlungsart.
  let range = {from: "", to: ""}, reasonF = "", payF = "", lastAnalysis = null;
  if (!root) return;
  const EN = document.documentElement.lang === "en";
  const LATEST = root.dataset.latest || "";
  const DOWNLOAD = root.dataset.download || "#";

  const T = EN ? {
    loc: "en-US", searching: "Looking for Pump Paper in this browser …",
    none: "This is what your paper account looks like, here with <b>sample data</b>.",
    noneHint: "Your own account, with radar, PnL calendar and achievements, opens in the extension via “Konto ↗” in the toolbar window.",
    old: v => `Pump Paper ${v} is installed but can't share account data yet. That needs version 1.7. Below you see <b>sample data</b>.`,
    ok: v => `Pump Paper ${v} is installed. These are your own paper trades, read straight from the extension.`,
    upd: v => `<a href="${DOWNLOAD}">Update to ${v}</a> available.`, current: "up to date",
    sample: "Sample data", reload: "Reload",
    tiles: ["Total value", "Result since start", "Realised", "Open positions"],
    sinceStart: s => `start ${s}`, afterGas: "after fees and gas", unreal: u => `${u} unrealised`,
    curveH: "Result over time", curveNote: "Realised result after gas, one point per sell.",
    tipsH: "Tips", tipsNote: "Derived from your trades. Paper results don't promise anything for real money.",
    anaH: "Trade analysis", reasonH: "By exit reason", posH: "Open positions", tradesH: "Trades",
    stats: {sells: "Sells", hit: "Hit rate", avgWin: "Average win", avgLoss: "Average loss", payoff: "Win / loss ratio",
      pf: "Profit factor", exp: "Per trade", best: "Best trade", worst: "Worst trade", fees: "Fees", gas: "Gas",
      costShare: "Costs of volume", holdWin: "Hold time winners", holdLoss: "Hold time losers", failed: "Failed trades"},
    reasonCols: ["Reason", "Trades", "Hit rate", "Result", "Ø return"],
    posCols: ["Coin", "Cost", "Value now", "Result", "Target / stop", "Open for"],
    tradeCols: ["Time", "Coin", "Side", "Amount", "Result", "Reason", "Held"],
    side: {kauf: "buy", verkauf: "sell", fehlgeschlagen: "failed"},
    reason: {"Ziel": "target", "Stop": "stop", "Zeit": "time", "von Hand": "manual"},
    periods: [["7", "7 days"], ["30", "30 days"], ["all", "All"]], csvBtn: "Load CSV", csvHint: "Load the CSV from the history tab and analyse it here. It stays in this tab.",
    csvOk: (n, f) => `CSV loaded: ${n} rows from ${f}. Only in this browser tab, nothing is uploaded.`, csvBad: "This file doesn't look like a Pump Paper CSV.",
    csvTiles: ["Sells", "Realised", "Hit rate", "Period"], search: "Search trades …", hourH: "By time of day", mcH: "By market cap at buy",
    hourCols: ["Time", "Trades", "Hit rate", "Result"], mcCols: ["Market cap", "Trades", "Hit rate", "Result"],
    dd: "Largest drawdown", winStreak: "Longest winning streak", lossStreak: "Longest losing streak",
    dayH: "By weekday", sizeH: "By size", holdH: "By holding time", days7: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayCols: ["Day", "Trades", "Hit rate", "Result"], sizeCols: ["Size", "Trades", "Hit rate", "Result"], holdCols: ["Held", "Trades", "Hit rate", "Result"],
    bestDay: "Best day", worstDay: "Worst day", costTrade: "Costs per trade", barsH: "Each trade", barsNote: "Result per sell, oldest left. Green won, red lost.",
    from: "From", to: "To", allReasons: "All reasons", allPay: "SOL and USDC", export: "Export analysis", print: "Print",
    toLab: "Use as strategy", toLabNote: "Suggests target, stop and market cap range from your winners and losers and opens them in the strategy lab. You decide what to keep.",
    empty: "No trades in this selection. Widen the period or reset the filters.", oldCsv: "This CSV is from an older version without market cap columns. Market cap analysis is missing.",
    drop: "Drop the CSV here",
    more2: "Glossary",
    explain: {sells: "Closed positions in the selection.", hit: "Share of sells with a profit.", payoff: "Average win divided by average loss.",
      pf: "All wins divided by all losses. Above 1 the trades carry themselves.", exp: "Average result per sell.", costShare: "Fees and gas as a share of everything you bought and sold.",
      dd: "Largest drop of the result curve from a high.", failed: "Buys that failed on slippage and only cost the priority fee."},
    noPos: "No open positions.", noTrades: "No trades yet.", more: n => `Show all ${n}`, noQuote: "no price yet",
    tip: {
      few: n => `Only ${n} sells so far. Tips get reliable from about 20 trades.`,
      costs: (p, c) => `Fees and gas ate ${p} % of your gross profit (${c}). Fewer, larger trades keep more of it.`,
      costsLoss: c => `On top of the trading loss you paid ${c} in fees and gas. Every trade starts in the red by about 1.5 %.`,
      failed: (n, c) => `${n} trades failed, mostly on slippage, costing ${c} for nothing. You bought into moves that were already running. Click earlier or skip the coin.`,
      stopSlip: (a, s) => `Your stops filled at ${a} on average, set at ${s}. In a crash the next price is already far below. Keep the coin page open, then Pump Paper checks every second instead of every 30.`,
      holdLosers: (l, w) => `You hold losers longer (${l}) than winners (${w}). Cut losses as fast as you take profits.`,
      cutWinners: (a, t) => `Manual sells of winners made ${a} on average, your target is ${t}. If you sell early on purpose, lower the target, otherwise let it work.`,
      payoff: (h, p) => `Hit rate ${h} with a win/loss ratio of ${p} does not add up. Either win more often or let winners run further than losers.`,
      timeOut: (n, a) => `${n} trades ended on the time limit with ${a} on average. These coins went nowhere: a shorter limit frees money sooner.`,
      size: p => `Your average buy is ${p} of your balance. Above 10 % a couple of stops hurt a lot. Smaller sizes give the statistics time.`,
      good: (h, pf) => `Hit rate ${h} and profit factor ${pf}: that holds up so far. Keep the size and check again after more trades.`,
    },
  } : {
    loc: "de-DE", searching: "Suche Pump Paper in diesem Browser …",
    none: "So sieht dein Papier-Konto aus, hier mit <b>Beispieldaten</b>.",
    noneHint: "Dein eigenes Konto, mit Radar, PnL-Kalender und Erfolgen, öffnest du in der Erweiterung über „Konto ↗“ im Fenster in der Symbolleiste.",
    old: v => `Pump Paper ${v} ist installiert, kann aber noch keine Kontodaten teilen. Das geht ab Version 1.7. Unten siehst du <b>Beispieldaten</b>.`,
    ok: v => `Pump Paper ${v} ist installiert. Das sind deine eigenen Papier-Trades, direkt aus der Erweiterung gelesen.`,
    upd: v => `<a href="${DOWNLOAD}">Update auf ${v}</a> verfügbar.`, current: "aktuell",
    sample: "Beispieldaten", reload: "Neu laden",
    tiles: ["Gesamtwert", "Ergebnis seit Start", "Realisiert", "Offene Positionen"],
    sinceStart: s => `Start ${s}`, afterGas: "nach Gebühren und Gas", unreal: u => `${u} nicht realisiert`,
    curveH: "Ergebnis über die Zeit", curveNote: "Realisiertes Ergebnis nach Gas, ein Punkt je Verkauf.",
    tipsH: "Tipps", tipsNote: "Aus deinen Trades abgeleitet. Papier-Ergebnisse versprechen nichts für echtes Geld.",
    anaH: "Trade-Analyse", reasonH: "Nach Verkaufsgrund", posH: "Offene Positionen", tradesH: "Trades",
    stats: {sells: "Verkäufe", hit: "Trefferquote", avgWin: "Ø Gewinn", avgLoss: "Ø Verlust", payoff: "Gewinn / Verlust",
      pf: "Profit-Faktor", exp: "Je Trade", best: "Bester Trade", worst: "Schlechtester Trade", fees: "Gebühren", gas: "Gas",
      costShare: "Kosten vom Volumen", holdWin: "Haltedauer Gewinner", holdLoss: "Haltedauer Verlierer", failed: "Gescheiterte Trades"},
    reasonCols: ["Grund", "Trades", "Treffer", "Ergebnis", "Ø Rendite"],
    posCols: ["Coin", "Einsatz", "Wert jetzt", "Ergebnis", "Ziel / Stop", "Offen seit"],
    tradeCols: ["Zeit", "Coin", "Seite", "Betrag", "Ergebnis", "Grund", "Gehalten"],
    side: {kauf: "Kauf", verkauf: "Verkauf", fehlgeschlagen: "gescheitert"},
    reason: {},
    periods: [["7", "7 Tage"], ["30", "30 Tage"], ["all", "Alles"]], csvBtn: "CSV laden", csvHint: "Die CSV aus dem Verlauf laden und hier auswerten. Sie bleibt in diesem Tab.",
    csvOk: (n, f) => `CSV geladen: ${n} Zeilen aus ${f}. Nur in diesem Browser-Tab, nichts wird hochgeladen.`, csvBad: "Diese Datei sieht nicht wie eine CSV von Pump Paper aus.",
    csvTiles: ["Verkäufe", "Realisiert", "Trefferquote", "Zeitraum"], search: "Trades durchsuchen …", hourH: "Nach Tageszeit", mcH: "Nach Marktwert beim Kauf",
    hourCols: ["Uhrzeit", "Trades", "Treffer", "Ergebnis"], mcCols: ["Marktwert", "Trades", "Treffer", "Ergebnis"],
    dd: "Größter Rückgang", winStreak: "Längste Gewinnserie", lossStreak: "Längste Verlustserie",
    dayH: "Nach Wochentag", sizeH: "Nach Einsatz", holdH: "Nach Haltedauer", days7: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    dayCols: ["Tag", "Trades", "Treffer", "Ergebnis"], sizeCols: ["Einsatz", "Trades", "Treffer", "Ergebnis"], holdCols: ["Gehalten", "Trades", "Treffer", "Ergebnis"],
    bestDay: "Bester Tag", worstDay: "Schlechtester Tag", costTrade: "Kosten je Trade", barsH: "Jeder Trade", barsNote: "Ergebnis je Verkauf, ältester links. Grün gewonnen, rot verloren.",
    from: "Von", to: "Bis", allReasons: "Alle Gründe", allPay: "SOL und USDC", export: "Auswertung exportieren", print: "Drucken",
    toLab: "Als Strategie übernehmen", toLabNote: "Schlägt Ziel, Stop und Marktwert-Bereich aus deinen Gewinnern und Verlierern vor und öffnet sie im Strategie-Labor. Was du behältst, entscheidest du.",
    empty: "Keine Trades in dieser Auswahl. Zeitraum erweitern oder Filter zurücksetzen.", oldCsv: "Diese CSV stammt aus einer älteren Version ohne Marktwert-Spalten. Die Auswertung nach Marktwert fehlt.",
    drop: "CSV hier ablegen",
    more2: "Lexikon",
    explain: {sells: "Geschlossene Positionen in der Auswahl.", hit: "Anteil der Verkäufe mit Gewinn.", payoff: "Ø Gewinn geteilt durch Ø Verlust.",
      pf: "Alle Gewinne geteilt durch alle Verluste. Über 1 tragen sich die Trades.", exp: "Durchschnittliches Ergebnis je Verkauf.", costShare: "Gebühren und Gas im Verhältnis zu allem, was du gekauft und verkauft hast.",
      dd: "Größter Rückgang der Ergebniskurve von einem Hoch.", failed: "Käufe, die an der Slippage gescheitert sind und nur die Priority Fee gekostet haben."},
    noPos: "Keine offenen Positionen.", noTrades: "Noch keine Trades.", more: n => `Alle ${n} zeigen`, noQuote: "noch kein Kurs",
    tip: {
      few: n => `Erst ${n} Verkäufe. Belastbar werden die Tipps ab etwa 20 Trades.`,
      costs: (p, c) => `Gebühren und Gas haben ${p} % deines Bruttogewinns gefressen (${c}). Weniger, dafür größere Trades behalten mehr davon.`,
      costsLoss: c => `Zusätzlich zum Handelsverlust hast du ${c} an Gebühren und Gas bezahlt. Jeder Trade startet mit etwa 1,5 % im Minus.`,
      failed: (n, c) => `${n} Trades sind gescheitert, meist an der Slippage, und haben ${c} umsonst gekostet. Du hast in Bewegungen gekauft, die schon liefen. Früher klicken oder den Coin auslassen.`,
      stopSlip: (a, s) => `Deine Stops wurden im Schnitt bei ${a} ausgeführt, gesetzt waren ${s}. Im Absturz liegt der nächste Kurs schon weit darunter. Lass die Coinseite offen, dann prüft Pump Paper jede Sekunde statt alle 30.`,
      holdLosers: (l, w) => `Verlierer hältst du länger (${l}) als Gewinner (${w}). Verluste genauso schnell schließen wie Gewinne.`,
      cutWinners: (a, t) => `Von Hand verkaufte Gewinner brachten im Schnitt ${a}, dein Ziel liegt bei ${t}. Wenn du absichtlich früher verkaufst, setz das Ziel tiefer, sonst lass es arbeiten.`,
      payoff: (h, p) => `Trefferquote ${h} bei einem Gewinn-Verlust-Verhältnis von ${p} geht nicht auf. Entweder öfter treffen oder Gewinner weiter laufen lassen als Verlierer.`,
      timeOut: (n, a) => `${n} Trades endeten am Zeitlimit mit im Schnitt ${a}. Diese Coins kamen nicht vom Fleck: Ein kürzeres Limit macht das Geld früher frei.`,
      size: p => `Dein Ø Kauf ist ${p} deines Guthabens. Über 10 % tun ein paar Stops sehr weh. Kleinere Beträge geben der Statistik Zeit.`,
      good: (h, pf) => `Trefferquote ${h} und Profit-Faktor ${pf}: Das trägt bisher. Größe beibehalten und nach mehr Trades wieder prüfen.`,
    },
  };

  // ---------- Formatierung, alles über textContent oder esc(), denn Coin-Namen kommen von pump.fun ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const num = (x, d) => (Number(x) || 0).toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-(?=[0.,]*$)/, "").replace(/^-/, "−");
  const sgn = (x, d) => (x > 0 ? "+" : "") + num(x, d);
  const sol = (x, d = 3) => num(x, d) + " SOL";
  const ssol = (x, d = 3) => sgn(x, d) + " SOL";
  const pct = (x, d = 1) => num(x * 100, d) + " %";
  const spct = (x, d = 1) => sgn(x * 100, d) + " %";
  const cls = x => (x > 0 ? "gain" : x < 0 ? "loss" : "");
  const isMint = m => typeof m === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m);
  function dur(ms) {
    if (!(ms > 0)) return "–";
    const s = Math.round(ms / 1000);
    if (s < 60) return s + " s";
    const m = Math.round(s / 60);
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60);
    return h < 24 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
  }
  const when = ts => new Date(ts).toLocaleString(T.loc, {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
  const reasonName = r => T.reason[r] || r || "–";
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

  // ---------- Verbindung zur Erweiterung ----------
  let hello = null, done = false;
  function onMessage(e) {
    if (e.source !== window || !e.data || e.data.source !== "pump-paper") return;
    const d = e.data;
    // Die Erweiterung lädt oft erst nach dieser Seite und meldet sich dann mit hello: dann noch einmal fragen.
    if (d.type === "hello") { hello = String(d.version || "?"); if (!done) ask("account"); }
    if (d.type === "account" && !done) { done = true; show(d, false); }
  }
  window.addEventListener("message", onMessage);
  const ask = type => window.postMessage({source: "pump-paper-site", type}, "*");

  function connect() {
    done = false;
    hello = document.documentElement.getAttribute("data-pump-paper") || hello;
    status("search");
    ask("ping");
    ask("account");
    setTimeout(() => {
      if (done) return;
      hello = hello || document.documentElement.getAttribute("data-pump-paper");
      done = true;
      show(sample(), true);
    }, 2000);
  }

  function newer(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  }

  function status(state, isSample) {
    const box = root.querySelector("[data-status]");
    let text, kind = "info";
    if (state === "search") text = T.searching;
    else if (!hello) { text = T.none + " " + T.noneHint; kind = "warn"; }
    else if (isSample) { text = T.old(esc(hello)); kind = "warn"; }
    else { text = T.ok(esc(hello)); kind = "ok"; }
    if (hello && LATEST) text += " " + (newer(LATEST, hello) ? T.upd(esc(LATEST)) : `<span class="k-pill">${T.current}</span>`);
    if (state !== "search") text += ` <button type="button" class="k-link" data-reload>${T.reload}</button>`;
    box.className = "k-status " + kind;
    box.innerHTML = text;
  }

  root.addEventListener("click", e => {
    if (e.target.closest("[data-reload]")) connect();
    const more = e.target.closest("[data-more]");
    if (more) { root.querySelector(".k-trades").classList.add("all"); more.remove(); }
    const per = e.target.closest("[data-period]");
    if (per) { period = per.dataset.period; render(); }
  });
  root.addEventListener("change", e => {
    if (e.target.matches("[data-range]")) { range[e.target.dataset.range] = e.target.value; render(); }
    if (e.target.matches("[data-reason]")) { reasonF = e.target.value; render(); }
    if (e.target.matches("[data-pay]")) { payF = e.target.value; render(); }
  });
  root.addEventListener("click", e => {
    if (e.target.closest("[data-export]")) exportCsv();
    if (e.target.closest("[data-print]")) print();
    const th = e.target.closest(".k-sort")?.closest("th");
    if (th) sortBy(th);
  });
  // Tabellen sortieren: Klick auf den Spaltenkopf, nochmal klicken dreht die Richtung.
  function sortBy(th) {
    const table = th.closest("table"), i = [...th.parentNode.children].indexOf(th);
    const dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
    th.parentNode.querySelectorAll("th").forEach(h => h.removeAttribute("aria-sort"));
    th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
    const val = tr => {
      const t = tr.children[i]?.textContent.trim() || "";
      const n = Number(t.replace(/[^\d,.−-]/g, "").replace("−", "-").replace(EN ? /,/g : /\./g, "").replace(",", "."));
      return /\d/.test(t) && isFinite(n) && !/[a-z]{3,}/i.test(t.replace(/SOL|USDC|min|Uhr|h\b|%|\$/g, "")) ? n : t.toLowerCase();
    };
    const body = table.tBodies[0];
    [...body.rows].sort((x, y) => { const a = val(x), b = val(y); return (a > b ? 1 : a < b ? -1 : 0) * dir; }).forEach(r => body.appendChild(r));
  }
  // CSV per Ziehen und Ablegen.
  root.addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); root.classList.add("drop"); } });
  root.addEventListener("dragleave", e => { if (e.target === root) root.classList.remove("drop"); });
  root.addEventListener("drop", e => {
    const f = e.dataTransfer?.files?.[0];
    root.classList.remove("drop");
    if (!f) return;
    e.preventDefault();
    loadFile(f);
  });
  root.addEventListener("input", e => {
    if (!e.target.matches("[data-search]")) return;
    const v = e.target.value.trim().toLowerCase();
    const table = root.querySelector(".k-trades");
    if (!table) return;
    table.classList.toggle("all", !!v);
    table.querySelectorAll("tbody tr").forEach(tr => (tr.hidden = !!v && !tr.textContent.toLowerCase().includes(v)));
  });
  let oldCsv = false;
  function loadFile(file) {
    file.text().then(text => {
      const history = parseCsv(text);
      if (!history.length) { csvNote = T.csvBad; render(); return; }
      oldCsv = !/marktwert_usd/i.test(text.split(/\r?\n/)[0]);
      csvNote = T.csvOk(history.length, file.name);
      show({csv: true, history, positions: [], solUsd: Number(history[history.length - 1].solUsd) || 0}, false, true);
    });
  }
  root.addEventListener("change", e => {
    if (!e.target.matches("[data-csv]") || !e.target.files[0]) return;
    loadFile(e.target.files[0]);
  });

  // ---------- CSV aus dem Verlauf der Erweiterung ----------
  // Spalten (Anleitung): zeit;coin;mint;seite;waehrung;betrag;tokens;gebuehr;gebuehr_prozent;gas_sol;ergebnis;rendite;grund;marktwert_usd;sol_usd
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const split = line => {
      const out = []; let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
        else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ""; } else cur += c;
      }
      out.push(cur);
      return out;
    };
    const head = split(lines[0]).map(h => h.trim().toLowerCase());
    const col = name => head.indexOf(name);
    if (col("zeit") < 0 || col("seite") < 0) return [];
    const get = (row, name) => (col(name) >= 0 ? row[col(name)] : "");
    const n = (row, name) => Number(String(get(row, name)).replace(",", ".")) || 0;
    const rows = lines.slice(1).map(split).map(r => ({
      ts: Date.parse(get(r, "zeit")), symbol: get(r, "coin"), mint: get(r, "mint"), side: get(r, "seite"), pay: get(r, "waehrung") || "SOL",
      amount: n(r, "betrag"), tokens: n(r, "tokens"), fee: n(r, "gebuehr"), feePct: n(r, "gebuehr_prozent"), gas: n(r, "gas_sol"),
      pnl: n(r, "ergebnis"), ret: n(r, "rendite"), reason: get(r, "grund"), mcUsd: n(r, "marktwert_usd"), solUsd: n(r, "sol_usd"),
    })).filter(r => r.ts && ["kauf", "verkauf", "fehlgeschlagen"].includes(r.side)).sort((a, b) => a.ts - b.ts);
    // Haltedauer steht nicht in der CSV: vom letzten Kauf desselben Coins bis zum Verkauf.
    const lastBuy = {};
    for (const r of rows) {
      if (r.side === "kauf") lastBuy[r.mint] = lastBuy[r.mint] || r.ts;
      if (r.side === "verkauf" && lastBuy[r.mint]) { r.held = r.ts - lastBuy[r.mint]; delete lastBuy[r.mint]; }
    }
    return rows;
  }

  // ---------- Auswertung ----------
  function analyse(acc) {
    const solUsd = Number(acc.solUsd) || 0;
    // USDC-Beträge zum Kurs des Trades in SOL umrechnen, damit alles in einer Einheit zusammenläuft.
    const inSol = (x, t) => (t.pay === "USDC" ? (Number(x) || 0) / (Number(t.solUsd) || solUsd || 1) : Number(x) || 0);
    const hist = (Array.isArray(acc.history) ? acc.history : []).filter(t => t && t.ts).sort((a, b) => a.ts - b.ts);
    const sells = hist.filter(t => t.side === "verkauf");
    const buys = hist.filter(t => t.side === "kauf");
    const failed = hist.filter(t => t.side === "fehlgeschlagen");
    const pnl = t => inSol(t.pnl, t);
    const wins = sells.filter(t => pnl(t) > 0), losses = sells.filter(t => pnl(t) <= 0);
    const sum = (a, f) => a.reduce((s, t) => s + f(t), 0);
    const gross = sum(sells, pnl);
    const gas = sum(sells, t => Number(t.gas) || 0) + sum(failed, t => Number(t.gas) || 0)
      + sum(Array.isArray(acc.positions) ? acc.positions : [], p => Number(p.gas) || 0);
    const fees = sum(hist, t => inSol(t.fee, t));
    const volume = sum(buys, t => inSol(t.amount, t)) + sum(sells, t => inSol(t.amount, t));
    const winSum = sum(wins, pnl), lossSum = -sum(losses, pnl);

    // Das Gas eines Verkaufs enthält schon den anteiligen Kauf-Gas. Realisiert ist also Ergebnis minus Gas je Verkauf,
    // und alles Gas zusammen ist Verkäufe plus gescheiterte Trades plus das, was in offenen Positionen steckt.
    const curve = [];
    let run = 0;
    for (const t of sells) { run += pnl(t) - (Number(t.gas) || 0); curve.push({ts: t.ts, v: run}); }
    const failedCost = sum(failed, t => Number(t.gas) || 0);
    const realised = run - failedCost;

    const quotes = acc.quotes || {};
    const positions = (Array.isArray(acc.positions) ? acc.positions : []).map(p => {
      const q = quotes[p.mint];
      let value = null;
      if (q && q.qRes > 0 && q.tRes > 0) {
        const f = q.fees ? ((+q.fees.lp || 0) + (+q.fees.protocol || 0) + (+q.fees.creator || 0)) / 10000 : 0.0125;
        value = q.qRes * p.tokens / (q.tRes + p.tokens) * (1 - f);
      }
      const t = {pay: p.pay, solUsd: q?.solUsd || solUsd};
      return {...p, value, valueSol: value == null ? inSol(p.cost, t) : inSol(value, t), costSol: inSol(p.cost, t)};
    });
    const wallet = acc.wallet || {};
    const openSol = sum(positions, p => p.valueSol);
    const total = (Number(wallet.SOL) || 0) + (Number(wallet.USDC) || 0) / (solUsd || 1) + openSol;
    const start = acc.start || {};
    const startTotal = (Number(start.SOL) || 0) + (Number(start.USDC) || 0) / (solUsd || 1);

    const byReason = {};
    for (const t of sells) {
      const k = t.reason || "–";
      const r = byReason[k] || (byReason[k] = {n: 0, wins: 0, pnl: 0, ret: 0, rets: []});
      r.n++; r.pnl += pnl(t); r.ret += Number(t.ret) || 0; r.rets.push(Number(t.ret) || 0);
      if (pnl(t) > 0) r.wins++;
    }

    return {
      hist, sells, buys, failed, wins, losses, gross, gas, fees, volume, curve, realised, positions, total, startTotal, openSol,
      unreal: sum(positions, p => p.valueSol - p.costSol), wallet, solUsd, byReason, failedCost,
      hit: sells.length ? wins.length / sells.length : 0,
      avgWin: wins.length ? winSum / wins.length : 0, avgLoss: losses.length ? lossSum / losses.length : 0,
      pf: lossSum > 0 ? winSum / lossSum : wins.length ? Infinity : 0,
      best: sells.reduce((b, t) => (!b || pnl(t) > pnl(b) ? t : b), null),
      worst: sells.reduce((b, t) => (!b || pnl(t) < pnl(b) ? t : b), null),
      holdWin: median(wins.map(t => +t.held || 0).filter(Boolean)), holdLoss: median(losses.map(t => +t.held || 0).filter(Boolean)),
      avgBuy: buys.length ? sum(buys, t => inSol(t.amount, t)) / buys.length : 0, pnl,
      ...extra(hist, sells, curve, pnl),
    };
  }

  function extra(hist, sells, curve, pnl) {
    let peak = 0, dd = 0;
    for (const p of curve) { peak = Math.max(peak, p.v); dd = Math.max(dd, peak - p.v); }
    let w = 0, l = 0, maxW = 0, maxL = 0;
    for (const s of sells) { if (pnl(s) > 0) { w++; l = 0; } else { l++; w = 0; } maxW = Math.max(maxW, w); maxL = Math.max(maxL, l); }
    const bucket = (map, key, s) => { const b = map[key] || (map[key] = {n: 0, wins: 0, pnl: 0}); b.n++; b.pnl += pnl(s); if (pnl(s) > 0) b.wins++; };
    const byHour = {}, byMc = {}, byDay = {}, bySize = {}, byHold = {}, perDay = {};
    const buyMc = {}, buyAmt = {};
    for (const t of hist) {
      if (t.side === "kauf" && buyMc[t.mint] === undefined) { buyMc[t.mint] = Number(t.mcUsd) || 0; buyAmt[t.mint] = Number(t.amount) || 0; }
      if (t.side !== "verkauf") continue;
      const d = new Date(t.ts), h = d.getHours();
      bucket(byHour, Math.floor(h / 4) * 4, t);
      bucket(byDay, (d.getDay() + 6) % 7, t);
      const day = d.toLocaleDateString(T.loc);
      perDay[day] = (perDay[day] || 0) + pnl(t);
      const amt = buyAmt[t.mint];
      delete buyAmt[t.mint];
      if (amt && t.pay !== "USDC") bucket(bySize, amt < 0.1 ? 0 : amt < 0.25 ? 1 : amt < 0.5 ? 2 : amt < 1 ? 3 : 4, t);
      const held = +t.held || 0;
      if (held) bucket(byHold, held < 60e3 ? 0 : held < 300e3 ? 1 : held < 900e3 ? 2 : held < 3600e3 ? 3 : 4, t);
      const mc = buyMc[t.mint];
      delete buyMc[t.mint];
      if (mc) bucket(byMc, mc < 10e3 ? 0 : mc < 30e3 ? 1 : mc < 100e3 ? 2 : mc < 1e6 ? 3 : 4, t);
    }
    const dayList = Object.entries(perDay).sort((x, y) => y[1] - x[1]);
    return {drawdown: dd, maxWin: maxW, maxLoss: maxL, byHour, byMc, byDay, bySize, byHold,
            bestDay: dayList[0] || null, worstDay: dayList.length > 1 ? dayList[dayList.length - 1] : null};
  }

  // Lexikon-Anker je Sprache.
  const A = EN ? {slippage: "slippage", regeln: "rules", gebuehr: "fee", erwartung: "expectancy", drawdown: "drawdown", profitfaktor: "profit-factor"}
    : {slippage: "slippage", regeln: "regeln", gebuehr: "gebuehr", erwartung: "erwartung", drawdown: "drawdown", profitfaktor: "profitfaktor"};
  function tips(a) {
    const out = [];
    const n = a.sells.length;
    const ps = positionsRules(a);
    if (n < 20) out.push(["info", T.tip.few(n)]);
    if (a.failed.length >= 3 && a.failed.length / Math.max(1, a.buys.length + a.failed.length) > 0.1)
      out.push(["warn", T.tip.failed(a.failed.length, sol(a.failedCost, 4)), A.slippage]);
    const stops = a.byReason["Stop"];
    if (stops && stops.n >= 3) {
      const avg = stops.ret / stops.n;
      if (avg < ps.sl - 0.05) out.push(["warn", T.tip.stopSlip(spct(avg), spct(ps.sl, 0)), A.regeln]);
    }
    const costs = a.fees + a.gas;
    if (a.gross > 0 && costs / (a.gross + costs) > 0.3) out.push(["warn", T.tip.costs(num(costs / (a.gross + costs) * 100, 0), sol(costs)), A.gebuehr]);
    else if (a.gross <= 0 && n >= 5) out.push(["warn", T.tip.costsLoss(sol(costs))]);
    if (a.holdWin && a.holdLoss && a.holdLoss > a.holdWin * 1.5 && a.wins.length >= 3 && a.losses.length >= 3)
      out.push(["warn", T.tip.holdLosers(dur(a.holdLoss), dur(a.holdWin))]);
    const hand = a.sells.filter(t => t.reason === "von Hand" && a.pnl(t) > 0);
    if (hand.length >= 3) {
      const avg = hand.reduce((s, t) => s + (+t.ret || 0), 0) / hand.length;
      if (ps.tp && avg < ps.tp / 2) out.push(["info", T.tip.cutWinners(spct(avg), spct(ps.tp, 0))]);
    }
    const time = a.byReason["Zeit"];
    if (time && time.n >= 3 && Math.abs(time.ret / time.n) < 0.08) out.push(["info", T.tip.timeOut(time.n, spct(time.ret / time.n)), A.regeln]);
    if (n >= 10 && a.avgLoss > 0 && a.hit * (a.avgWin / a.avgLoss) < (1 - a.hit))
      out.push(["warn", T.tip.payoff(pct(a.hit, 0), num(a.avgWin / a.avgLoss, 2)), A.erwartung]);
    const bal = (Number(a.wallet.SOL) || 0) + a.openSol;
    if (a.avgBuy && bal > 0 && a.avgBuy / bal > 0.1) out.push(["warn", T.tip.size(pct(a.avgBuy / bal, 0)), A.drawdown]);
    if (n >= 20 && a.pf >= 1.3 && a.hit >= 0.35) out.push(["good", T.tip.good(pct(a.hit, 0), a.pf === Infinity ? "∞" : num(a.pf, 2)), A.profitfaktor]);
    return out;
  }
  // Ziel und Stop stehen je Position, für die Tipps zählen die Standardwerte aus den Optionen (falls mitgeliefert).
  function positionsRules(a) {
    const p = a.positions[0];
    const tp = Number(p?.tp) || 60, sl = Number(p?.sl) || -20;
    return {tp: tp / 100, sl: -Math.abs(sl) / 100};
  }

  // ---------- Darstellung ----------
  function curveSvg(points) {
    if (points.length < 2) return `<p class="k-empty">${T.noTrades}</p>`;
    const W = 720, H = 200, P = 8;
    const vs = points.map(p => p.v), lo = Math.min(0, ...vs), hi = Math.max(0, ...vs), span = hi - lo || 1;
    const x = i => P + i * (W - 2 * P) / (points.length - 1), y = v => P + (hi - v) * (H - 2 * P) / span;
    const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const last = points[points.length - 1].v;
    return `<svg class="k-curve ${cls(last)}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T.curveH)}: ${esc(ssol(last))}">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
      <polygon points="${x(0)},${y(0)} ${line} ${x(points.length - 1)},${y(0)}" class="area"/>
      <polyline points="${line}" class="ln" vector-effect="non-scaling-stroke"/></svg>
      <div class="k-curve-foot"><span>${esc(when(points[0].ts))}</span><b class="${cls(last)}">${esc(ssol(last))}</b><span>${esc(when(points[points.length - 1].ts))}</span></div>`;
  }

  function table(cols, rows, extra = "") {
    return `<div class="table-wrap"><table class="k-table ${extra}"><thead><tr>${cols.map(c => `<th><button type="button" class="k-sort">${esc(c)}</button></th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }
  const coin = (sym, mint) => isMint(mint)
    ? `<a href="https://pump.fun/coin/${mint}" rel="noopener" target="_blank">${esc(sym || mint.slice(0, 4) + "…")}</a>` : esc(sym || "–");
  const money = (x, pay, d = 3) => esc(num(x, pay === "USDC" ? 2 : d) + " " + (pay === "USDC" ? "USDC" : "SOL"));
  const smoney = (x, pay, d = 3) => esc(sgn(x, pay === "USDC" ? 2 : d) + " " + (pay === "USDC" ? "USDC" : "SOL"));

  let current = null, currentSample = false, period = "all", csvNote = "", fromCsv = false;
  function show(acc, isSample, csv) {
    current = acc; currentSample = isSample; fromCsv = !!csv;
    render();
  }
  const days = n => n + (T.loc === "de-DE" ? (n === 1 ? " Tag" : " Tage") : (n === 1 ? " day" : " days"));
  function render() {
    const acc0 = current, isSample = currentSample;
    if (!acc0) return;
    if (fromCsv) {
      const box = root.querySelector("[data-status]");
      box.className = "k-status ok"; box.textContent = csvNote;
    } else status("done", isSample);
    const cut = period === "all" ? 0 : Date.now() - Number(period) * 864e5;
    const fromTs = range.from ? Date.parse(range.from + "T00:00:00") : 0, toTs = range.to ? Date.parse(range.to + "T23:59:59") : Infinity;
    // Grund filtert die Verkäufe, die zugehörigen Käufe bleiben für Marktwert und Einsatz erhalten.
    const acc = {...acc0, history: (acc0.history || []).filter(h => h && h.ts >= cut && h.ts >= fromTs && h.ts <= toTs
      && (!payF || (h.pay || "SOL") === payF) && (!reasonF || h.side !== "verkauf" || (h.reason || "–") === reasonF))};
    const a = analyse(acc);
    lastAnalysis = a;
    const S = T.stats;
    const tile = (k, v, sub, c = "") => `<div class="k-tile"><span class="k">${esc(k)}</span><b class="${c}">${esc(v)}</b><small>${esc(sub)}</small></div>`;
    const change = a.total - a.startTotal;
    const span = a.hist.length ? `${new Date(a.hist[0].ts).toLocaleDateString(T.loc)} – ${new Date(a.hist[a.hist.length - 1].ts).toLocaleDateString(T.loc)}` : "–";
    const tilesHtml = fromCsv ? [
      tile(T.csvTiles[0], String(a.sells.length), a.failed.length ? `${a.failed.length} ${T.side.fehlgeschlagen}` : ""),
      tile(T.csvTiles[1], ssol(a.realised), T.afterGas, cls(a.realised)),
      tile(T.csvTiles[2], a.sells.length ? pct(a.hit, 0) : "–", ""),
      tile(T.csvTiles[3], days(new Set(a.hist.map(h => new Date(h.ts).toDateString())).size), span),
    ].join("") : [
      tile(T.tiles[0], sol(a.total), a.solUsd ? "≈ " + num(a.total * a.solUsd, 0) + " $" : ""),
      tile(T.tiles[1], ssol(change), T.sinceStart(sol(a.startTotal, 2)) + (a.startTotal ? " · " + spct(change / a.startTotal) : ""), cls(change)),
      tile(T.tiles[2], ssol(a.realised), T.afterGas, cls(a.realised)),
      tile(T.tiles[3], String(a.positions.length), a.positions.length ? T.unreal(ssol(a.unreal)) : "–", a.positions.length ? cls(a.unreal) : ""),
    ].join("");

    const E = T.explain;
    const stat = (k, v, c = "", ex = "") => `<div${ex ? ` title="${esc(ex)}"` : ""}><span class="k${ex ? " has-ex" : ""}">${esc(k)}</span><b class="${c}">${esc(v)}</b>${ex ? `<small class="ex">${esc(ex)}</small>` : ""}</div>`;
    const trades0 = a.sells.length + a.failed.length;
    const anaHtml = [
      stat(S.sells, String(a.sells.length), "", E.sells),
      stat(S.hit, a.sells.length ? pct(a.hit, 0) : "–", "", E.hit),
      stat(S.avgWin, a.wins.length ? ssol(a.avgWin) : "–", "gain"),
      stat(S.avgLoss, a.losses.length ? ssol(-a.avgLoss) : "–", "loss"),
      stat(S.payoff, a.avgLoss ? num(a.avgWin / a.avgLoss, 2) : "–", "", E.payoff),
      stat(S.pf, a.pf === Infinity ? "∞" : a.sells.length ? num(a.pf, 2) : "–", a.pf >= 1 ? "gain" : a.sells.length ? "loss" : "", E.pf),
      stat(S.exp, a.sells.length ? ssol(a.gross / a.sells.length) : "–", cls(a.gross), E.exp),
      stat(S.best, a.best ? `${a.best.symbol || "?"} ${spct(+a.best.ret || 0, 0)}` : "–", "gain"),
      stat(S.worst, a.worst ? `${a.worst.symbol || "?"} ${spct(+a.worst.ret || 0, 0)}` : "–", "loss"),
      stat(S.fees, sol(a.fees, 4)),
      stat(S.gas, sol(a.gas, 4)),
      stat(S.costShare, a.volume ? pct((a.fees + a.gas) / a.volume, 2) : "–", "", E.costShare),
      stat(T.costTrade, trades0 ? `${sol((a.fees + a.gas) / trades0, 4)} · ${a.volume ? pct((a.fees + a.gas) / trades0 / (a.volume / Math.max(1, a.buys.length + a.sells.length)), 1) : "–"}` : "–"),
      stat(T.bestDay, a.bestDay ? `${a.bestDay[0]} ${ssol(a.bestDay[1])}` : "–", a.bestDay ? cls(a.bestDay[1]) : ""),
      stat(T.worstDay, a.worstDay ? `${a.worstDay[0]} ${ssol(a.worstDay[1])}` : "–", a.worstDay ? cls(a.worstDay[1]) : ""),
      stat(S.holdWin, dur(a.holdWin)),
      stat(S.holdLoss, dur(a.holdLoss)),
      stat(S.failed, a.failed.length ? `${a.failed.length} · ${sol(a.failedCost, 3)}` : "0", "", E.failed),
      stat(T.dd, a.drawdown ? ssol(-a.drawdown) : "–", a.drawdown ? "loss" : "", E.dd),
      stat(T.winStreak, String(a.maxWin), a.maxWin ? "gain" : ""),
      stat(T.lossStreak, String(a.maxLoss), a.maxLoss ? "loss" : ""),
    ].join("");
    const bucketRows = (map, label) => Object.keys(map).map(Number).sort((x, y) => x - y).map(k => {
      const b = map[k];
      return `<tr><td>${esc(label(k))}</td><td>${b.n}</td><td>${esc(pct(b.wins / b.n, 0))}</td><td class="${cls(b.pnl)}">${esc(ssol(b.pnl))}</td></tr>`;
    });
    const hours = bucketRows(a.byHour, h => `${String(h).padStart(2, "0")}–${String(h + 4).padStart(2, "0")} ${T.loc === "de-DE" ? "Uhr" : "h"}`);
    const mcs = bucketRows(a.byMc, k => ["< 10k $", "10k–30k $", "30k–100k $", "100k–1M $", "> 1M $"][k]);
    const wdays = bucketRows(a.byDay, k => T.days7[(k + 1) % 7]);
    const sizes = bucketRows(a.bySize, k => ["< 0,1", "0,1–0,25", "0,25–0,5", "0,5–1", "≥ 1"][k].replace(/,/g, EN ? "." : ",") + " SOL");
    const holds = bucketRows(a.byHold, k => ["< 1 min", "1–5 min", "5–15 min", "15–60 min", "> 1 h"][k]);
    const reasonsAll = [...new Set((acc0.history || []).filter(h => h && h.side === "verkauf").map(h => h.reason || "–"))].sort();
    const toolbar = `<div class="k-toolbar"><div class="k-periods" role="group">${T.periods.map(([v, l]) =>
      `<button type="button" data-period="${v}" aria-pressed="${period === v}">${esc(l)}</button>`).join("")}</div>
      <label class="k-f">${esc(T.from)}<input type="date" data-range="from" value="${esc(range.from)}"></label>
      <label class="k-f">${esc(T.to)}<input type="date" data-range="to" value="${esc(range.to)}"></label>
      <label class="k-f"><span class="sr">${esc(T.allReasons)}</span><select data-reason><option value="">${esc(T.allReasons)}</option>${reasonsAll.map(r => `<option value="${esc(r)}"${r === reasonF ? " selected" : ""}>${esc(reasonName(r))}</option>`).join("")}</select></label>
      <label class="k-f"><span class="sr">${esc(T.allPay)}</span><select data-pay><option value="">${esc(T.allPay)}</option>${["SOL", "USDC"].map(p => `<option${p === payF ? " selected" : ""}>${p}</option>`).join("")}</select></label>
      <label class="btn small k-csv">${esc(T.csvBtn)}<input type="file" accept=".csv,text/csv" data-csv hidden></label>
      <button type="button" class="btn small" data-export>${esc(T.export)}</button>
      <button type="button" class="btn small" data-print>${esc(T.print)}</button>
      <small class="k-csv-hint">${esc(T.csvHint)} ${esc(T.drop)}.</small></div>`;

    const reasons = Object.entries(a.byReason).sort((x, y) => y[1].n - x[1].n).map(([k, r]) =>
      `<tr><td>${esc(reasonName(k))}</td><td>${r.n}</td><td>${esc(pct(r.wins / r.n, 0))}</td><td class="${cls(r.pnl)}">${esc(ssol(r.pnl))}</td><td class="${cls(r.ret)}">${esc(spct(r.ret / r.n))}</td></tr>`);

    const now = Date.now();
    const pos = a.positions.map(p => {
      const res = p.value == null ? null : p.value - p.cost;
      const tp = Number(p.tp), sl = Number(p.sl);
      return `<tr><td>${coin(p.symbol, p.mint)}</td><td>${money(p.cost, p.pay)}</td><td>${p.value == null ? esc(T.noQuote) : money(p.value, p.pay)}</td>
        <td class="${cls(res)}">${res == null ? "–" : smoney(res, p.pay) + " · " + esc(spct(res / (p.cost || 1)))}</td>
        <td>${tp ? esc(sgn(tp, 0) + " %") : "–"} / ${sl ? esc("−" + Math.abs(sl) + " %") : "–"}</td><td>${p.opened ? esc(dur(now - p.opened)) : "–"}</td></tr>`;
    });

    const trades = [...a.hist].reverse().map(t => {
      const s = T.side[t.side] || t.side;
      const res = t.side === "verkauf" ? `<span class="${cls(+t.pnl)}">${smoney(+t.pnl || 0, t.pay)} · ${esc(spct(+t.ret || 0))}</span>` : t.side === "fehlgeschlagen" ? `<span class="loss">−${esc(num(+t.gas || 0, 4))} SOL</span>` : "";
      return `<tr class="${t.side === "fehlgeschlagen" ? "failed" : ""}"><td>${esc(when(t.ts))}</td><td>${coin(t.symbol, t.mint)}</td><td>${esc(s)}</td>
        <td>${t.side === "fehlgeschlagen" ? "–" : money(+t.amount || 0, t.pay)}</td><td>${res}</td><td>${esc(t.side === "verkauf" ? reasonName(t.reason) : t.side === "fehlgeschlagen" ? (t.reason || "") : "")}</td>
        <td>${t.side === "verkauf" ? esc(dur(+t.held)) : ""}</td></tr>`;
    });

    const lex = EN ? "glossary.html#" : "lexikon.html#";
    const tipItems = tips(a).map(([k, text, anchor]) => `<li class="${k}">${esc(text)}${anchor ? ` <a href="${lex}${anchor}">${esc(T.more2)} →</a>` : ""}</li>`).join("");

    root.querySelector("[data-body]").innerHTML = `
      ${toolbar}
      ${isSample ? `<p class="k-sample">${esc(T.sample)}</p>` : ""}
      ${oldCsv ? `<p class="k-note warn">${esc(T.oldCsv)}</p>` : ""}
      ${!a.hist.length && (acc0.history || []).length ? `<p class="k-empty">${esc(T.empty)}</p>` : ""}
      <div class="k-tiles">${tilesHtml}</div>
      <section class="k-sec"><h2>${esc(T.curveH)}</h2><p class="k-note">${esc(T.curveNote)}</p>${curveSvg(a.curve)}</section>
      ${a.sells.length ? `<section class="k-sec"><h2>${esc(T.barsH)}</h2><p class="k-note">${esc(T.barsNote)}</p>${bars(a)}</section>` : ""}
      <section class="k-sec"><h2>${esc(T.tipsH)}</h2><p class="k-note">${esc(T.tipsNote)}</p><ul class="k-tips">${tipItems}</ul></section>
      <section class="k-sec"><h2>${esc(T.anaH)}</h2><div class="k-stats">${anaHtml}</div>
        ${reasons.length ? `<h3>${esc(T.reasonH)}</h3>` + table(T.reasonCols, reasons) : ""}
        ${hours.length ? `<h3>${esc(T.hourH)}</h3>` + table(T.hourCols, hours) : ""}
        ${mcs.length ? `<h3>${esc(T.mcH)}</h3>` + table(T.mcCols, mcs) : ""}
        ${wdays.length ? `<h3>${esc(T.dayH)}</h3>` + table(T.dayCols, wdays) : ""}
        ${sizes.length ? `<h3>${esc(T.sizeH)}</h3>` + table(T.sizeCols, sizes) : ""}
        ${holds.length ? `<h3>${esc(T.holdH)}</h3>` + table(T.holdCols, holds) : ""}
        ${a.sells.length >= 3 ? `<div class="k-tolab"><a class="btn small gold" href="${labLink(a)}">${esc(T.toLab)}</a><small>${esc(T.toLabNote)}</small></div>` : ""}</section>
      ${fromCsv ? "" : `<section class="k-sec"><h2>${esc(T.posH)}</h2>${pos.length ? table(T.posCols, pos) : `<p class="k-empty">${esc(T.noPos)}</p>`}</section>`}
      <section class="k-sec"><h2>${esc(T.tradesH)}</h2>${trades.length ? `<input type="search" class="k-search" data-search placeholder="${esc(T.search)}" aria-label="${esc(T.search)}">` : ""}${trades.length ? table(T.tradeCols, trades, "k-trades") : `<p class="k-empty">${esc(T.noTrades)}</p>`}
        ${trades.length > 25 ? `<button type="button" class="btn small" data-more>${esc(T.more(trades.length))}</button>` : ""}</section>`;
    root.classList.toggle("is-sample", isSample);
  }

  // Balken je Verkauf.
  function bars(a) {
    const list = a.sells.slice(-120), vals = list.map(t => a.pnl(t));
    const max = Math.max(...vals.map(Math.abs), 1e-9), W = 720, H = 120, bw = W / list.length;
    const rects = vals.map((v, i) => {
      const h = Math.max(1, Math.abs(v) / max * (H / 2 - 4));
      return `<rect x="${(i * bw + bw * 0.15).toFixed(1)}" y="${(v >= 0 ? H / 2 - h : H / 2).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${h.toFixed(1)}" class="${v >= 0 ? "gain" : "loss"}"><title>${esc(list[i].symbol || "")} ${esc(ssol(v))}</title></rect>`;
    }).join("");
    return `<svg class="k-bars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T.barsH)}: ${a.wins.length} / ${a.sells.length}"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="zero"/>${rects}</svg>`;
  }

  // Vorschlag für das Strategie-Labor aus den eigenen Trades: Ziel aus den Gewinnern, Stop aus den Verlierern, Marktwert-Bereich der Gewinner.
  function labLink(a) {
    const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    const winRets = a.wins.map(t => (+t.ret || 0) * 100).filter(x => x > 0), lossRets = a.losses.map(t => -(+t.ret || 0) * 100).filter(x => x > 0);
    const buyMc = {}; const winMc = [];
    for (const t of a.hist) { if (t.side === "kauf") buyMc[t.mint] = buyMc[t.mint] || +t.mcUsd || 0; if (t.side === "verkauf" && a.pnl(t) > 0 && buyMc[t.mint]) winMc.push(buyMc[t.mint]); }
    const round = (x, step) => Math.max(step, Math.round(x / step) * step);
    const s = {format: "pump-paper-strategy", version: 1, name: EN ? "From my trades" : "Aus meinen Trades",
      note: EN ? "Suggested from your paper trades on the account page." : "Vorschlag aus deinen Papier-Trades auf der Konto-Seite.",
      entry: {mcUsd: {min: winMc.length ? round(q(winMc, 0.1) * 0.9, 1000) : 0, max: winMc.length ? round(q(winMc, 0.9) * 1.1, 1000) : 100000},
              progress: {min: 0, max: 100}, ageMin: {min: 0, max: 60}},
      size: {mode: "sol", value: Math.round((a.avgBuy || 0.25) * 1000) / 1000 || 0.25},
      exit: {targetPct: Math.min(10000, Math.max(5, Math.round(q(winRets, 0.5) || 60))), stopPct: Math.min(100, Math.max(3, Math.round(q(lossRets, 0.5) || 20))),
             timeMin: Math.min(1440, Math.max(1, Math.round((a.holdWin || 600e3) / 60e3 * 2))), trailingPct: null, partial: null},
      limits: {maxOpen: 3, pauseAfterLosses: null}, execution: {delaySec: 1, slippagePct: 10, priorityFee: 0.001}};
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return (EN ? "strategy.html" : "strategie.html") + "#s=" + b64;
  }

  // Auswertung als CSV: Kennzahlen und alle Gruppen, so wie sie gerade gefiltert sind.
  function exportCsv() {
    const a = lastAnalysis;
    if (!a) return;
    const rows = [["bereich", "schluessel", "trades", "treffer", "ergebnis_sol"]];
    rows.push(["gesamt", "verkaeufe", a.sells.length, a.wins.length, a.gross.toFixed(6)]);
    rows.push(["gesamt", "gebuehren_sol", "", "", a.fees.toFixed(6)], ["gesamt", "gas_sol", "", "", a.gas.toFixed(6)], ["gesamt", "realisiert_sol", "", "", a.realised.toFixed(6)]);
    for (const [k, r] of Object.entries(a.byReason)) rows.push(["grund", k, r.n, r.wins, r.pnl.toFixed(6)]);
    for (const [name, map] of [["tageszeit", a.byHour], ["marktwert", a.byMc], ["wochentag", a.byDay], ["einsatz", a.bySize], ["haltedauer", a.byHold]])
      for (const [k, b] of Object.entries(map)) rows.push([name, k, b.n, b.wins, b.pnl.toFixed(6)]);
    const blob = new Blob([rows.map(r => r.join(";")).join("\n") + "\n"], {type: "text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pump-paper-auswertung.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // ---------- Beispieldaten: fest gewürfelt, damit die Seite bei jedem Laden gleich aussieht ----------
  function sample() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const syms = ["SUNNY", "BONKO", "PEPE2", "MOODENG", "GIGA", "WIF3", "CATSOL", "LUNA9", "FROG", "DOGEX", "HAMSTR", "ZOOM"];
    const mint = () => Array.from({length: 44}, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(rnd() * 58)]).join("");
    const history = [];
    let ts = Date.now() - 3 * 864e5, wallet = 10;
    for (let i = 0; i < 34; i++) {
      const symbol = syms[i % syms.length], m = mint(), amount = [0.1, 0.25, 0.5, 0.5, 1][Math.floor(rnd() * 5)];
      const mcUsd = 6000 + rnd() * 30000;
      ts += (40 + rnd() * 200) * 60e3;
      if (rnd() < 0.12) { history.push({ts, symbol, mint: m, side: "fehlgeschlagen", pay: "SOL", amount, gas: 0.001, reason: "Slippage", solUsd: 180, mcUsd}); wallet -= 0.001; continue; }
      const fee = amount * 0.0125, gasB = 0.00304;
      history.push({ts, symbol, mint: m, side: "kauf", pay: "SOL", amount, tokens: amount * 2e7, fee, feePct: 1.25, gas: gasB, solUsd: 180, mcUsd});
      const r = rnd();
      const [reason, ret, held] = r < 0.28 ? ["Ziel", 0.58 + rnd() * 0.08, 2e5 + rnd() * 3e5] : r < 0.6 ? ["Stop", -0.2 - rnd() * 0.14, 5e5 + rnd() * 6e5]
        : r < 0.75 ? ["Zeit", -0.05 + rnd() * 0.1, 6e5] : ["von Hand", -0.1 + rnd() * 0.45, 1e5 + rnd() * 4e5];
      const pnl = amount * ret, out = amount + pnl;
      ts += held;
      history.push({ts, symbol, mint: m, side: "verkauf", pay: "SOL", amount: out, tokens: amount * 2e7, fee: out * 0.0125 / 0.9875, feePct: 1.25,
        gas: 0.001 + gasB, pnl, ret, reason, held, solUsd: 180, mcUsd: mcUsd * (1 + ret)});
      wallet += pnl - 0.001 - gasB;
    }
    const m1 = mint(), m2 = mint();
    const positions = [
      {mint: m1, symbol: "TURBO", pay: "SOL", tokens: 9.1e6, cost: 0.5, gas: 0.00304, opened: Date.now() - 4 * 60e3, tp: 60, sl: -20, maxMin: 10},
      {mint: m2, symbol: "MOCHI", pay: "SOL", tokens: 6.2e6, cost: 0.25, gas: 0.00304, opened: Date.now() - 7 * 60e3, tp: 60, sl: -20, maxMin: 10},
    ];
    const fees = {lp: 0, protocol: 95, creator: 30};
    const quotes = {[m1]: {qRes: 41, tRes: 650e6, fees, solUsd: 180}, [m2]: {qRes: 33, tRes: 780e6, fees, solUsd: 180}};
    return {version: "", wallet: {SOL: wallet - 0.75, USDC: 1000}, solUsd: 180, start: {SOL: 10, USDC: 1000}, positions, history, quotes};
  }

  connect();
})();
