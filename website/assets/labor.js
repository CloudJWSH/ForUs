// Strategie-Labor, Oberfläche: Formular ↔ Strategie, Test auf simulierten Coins, Vergleich, Datei, Link und CSV.
// Alles bleibt im Browser. Es wird nichts gekauft.
(function () {
  const root = document.getElementById("labor");
  if (!root || !window.PPStrategie) return;
  const S = window.PPStrategie;
  const EN = document.documentElement.lang === "en";
  const loc = EN ? "en-US" : "de-DE";
  const T = EN ? {
    end: "Balance after test", pnl: "Result", hit: "Hit rate", pf: "Profit factor", dd: "Largest drawdown", trades: "Trades",
    failed: n => `${n} failed`, of: (n, c) => `${n} of ${c} coins bought`, vsHold: (x) => `Holding every bought coin to the end instead: ${x} SOL`,
    costs: (f, p, r) => `Costs: fees ${f} SOL · priority fees ${p} SOL · account rent ${r} SOL`,
    few: n => `Only ${n} trades. From about 20 on the result means something; before that it is mostly luck.`,
    none: "No coin matched the entry rules. Widen the market cap, curve or age range.",
    narrow: p => `Only ${p} % of the coins matched. Very narrow rules often fit one lucky test and fail on the next seed. Try a few seeds.`,
    seeds: "Tip: change the seed. A strategy that only works on one seed is probably luck.",
    reason: {target: "target", "target-part": "partial", trailing: "trailing", stop: "stop", time: "time", end: "coin ended", migration: "migration", fail: "failed (slippage)"},
    cols: ["Coin", "MC in", "MC out", "Reason", "Result", "%", "Held"], more: n => `Show all ${n}`,
    cmp: ["", "A (now)", "B (kept)"], cmpRows: ["Result", "Hit rate", "Profit factor", "Drawdown", "Trades"],
    saved: n => `Saved as "${n}" in this browser.`, deleted: "Deleted.", copied: "Copied.", linkCopied: "Link copied. Anyone who opens it sees this strategy in the lab.",
    loaded: n => `Loaded "${n}".`, bad: "The file has problems:", csvBad: "This file doesn't look like a Pump Paper CSV.",
    csv: (a, b) => `Your trades: ${a}. Only the ones the entry rule allows: ${b}.`, csvLine: s => `${s.n} trade${s.n === 1 ? "" : "s"}, hit rate ${pct(s.hit)}, result ${sol(s.pnl)} SOL`,
    csvNote: "Only the market cap at buy is checked here; curve and age are not in the CSV.",
    min: "min", chart: "Balance over the test", noTemplate: "–",
  } : {
    end: "Stand nach dem Test", pnl: "Ergebnis", hit: "Trefferquote", pf: "Profit-Faktor", dd: "Größter Rückgang", trades: "Trades",
    failed: n => `${n} gescheitert`, of: (n, c) => `${n} von ${c} Coins gekauft`, vsHold: (x) => `Jeden gekauften Coin stattdessen bis zum Ende halten: ${x} SOL`,
    costs: (f, p, r) => `Kosten: Gebühren ${f} SOL · Priority Fees ${p} SOL · Konto-Miete ${r} SOL`,
    few: n => `Nur ${n} Trades. Erst ab etwa 20 sagt das Ergebnis etwas, davor ist es vor allem Zufall.`,
    none: "Kein Coin passte zu den Einstiegsregeln. Marktwert, Kurve oder Alter weiter fassen.",
    narrow: p => `Nur ${p} % der Coins passten. Sehr enge Regeln passen oft nur auf einen glücklichen Test und versagen beim nächsten Startwert. Probier mehrere Startwerte.`,
    seeds: "Tipp: Startwert ändern. Eine Strategie, die nur bei einem Startwert funktioniert, ist vermutlich Glück.",
    reason: {target: "Ziel", "target-part": "Teil", trailing: "Nachziehen", stop: "Stop", time: "Zeit", end: "Coin vorbei", migration: "Migration", fail: "gescheitert (Slippage)"},
    cols: ["Coin", "MC rein", "MC raus", "Grund", "Ergebnis", "%", "Dauer"], more: n => `Alle ${n} zeigen`,
    cmp: ["", "A (jetzt)", "B (gemerkt)"], cmpRows: ["Ergebnis", "Trefferquote", "Profit-Faktor", "Größter Rückgang", "Trades"],
    saved: n => `Als „${n}“ in diesem Browser gespeichert.`, deleted: "Gelöscht.", copied: "Kopiert.", linkCopied: "Link kopiert. Wer ihn öffnet, sieht diese Strategie im Labor.",
    loaded: n => `„${n}“ geladen.`, bad: "Die Datei hat Fehler:", csvBad: "Das sieht nicht nach einer CSV aus Pump Paper aus.",
    csv: (a, b) => `Deine Trades: ${a}. Nur die, die die Einstiegsregel erlaubt: ${b}.`, csvLine: s => `${s.n} Trade${s.n === 1 ? "" : "s"}, Trefferquote ${pct(s.hit)}, Ergebnis ${sol(s.pnl)} SOL`,
    csvNote: "Geprüft wird hier nur der Marktwert beim Kauf; Kurve und Alter stehen nicht in der CSV.",
    min: "Min.", chart: "Guthaben über den Test", noTemplate: "–",
  };
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const fmt = (x, d) => Number(x).toLocaleString(loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const sol = x => (x > 0 ? "+" : "") + fmt(x, 3);
  const pct = x => fmt(x * 100, 0) + " %";
  const usd = x => x == null ? "–" : "$" + Math.round(x).toLocaleString(loc);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const num = id => { const v = String($(id).value).trim().replace(",", "."); return v === "" ? null : Number(v); };
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privater Modus */ } },
  };

  // ---------- Formular ↔ Strategie ----------
  function read() {
    const loss = num("l-loss"), part = num("l-part");
    return {
      format: S.FORMAT, version: S.VERSION, name: $("l-name").value.trim() || "Strategie", note: $("l-note").value,
      entry: {mcUsd: {min: num("l-mc-min") ?? 0, max: num("l-mc-max") ?? 1e8}, progress: {min: num("l-pg-min") ?? 0, max: num("l-pg-max") ?? 100},
              ageMin: {min: num("l-age-min") ?? 0, max: num("l-age-max") ?? 1440}},
      size: {mode: $("l-size-mode").value, value: num("l-size") ?? 0.25},
      exit: {targetPct: num("l-target"), stopPct: num("l-stop"), timeMin: num("l-time"), trailingPct: num("l-trail"), partial: part ? {sellPct: part} : null},
      limits: {maxOpen: num("l-open") ?? 3, pauseAfterLosses: loss ? {count: loss, minutes: num("l-pause") ?? 30} : null},
      execution: {delaySec: num("l-delay") ?? 1, slippagePct: num("l-slip") ?? 10, priorityFee: num("l-prio") ?? 0.001},
    };
  }
  function write(s) {
    const put = (id, v) => ($(id).value = v == null ? "" : String(v).replace(".", EN ? "." : ","));
    $("l-name").value = s.name; $("l-note").value = s.note || "";
    put("l-mc-min", s.entry.mcUsd.min); put("l-mc-max", s.entry.mcUsd.max);
    put("l-pg-min", s.entry.progress.min); put("l-pg-max", s.entry.progress.max);
    put("l-age-min", s.entry.ageMin.min); put("l-age-max", s.entry.ageMin.max);
    $("l-size-mode").value = s.size.mode; put("l-size", s.size.value);
    put("l-target", s.exit.targetPct); put("l-stop", s.exit.stopPct); put("l-time", s.exit.timeMin);
    put("l-trail", s.exit.trailingPct); put("l-part", s.exit.partial ? s.exit.partial.sellPct : null);
    put("l-open", s.limits.maxOpen); put("l-loss", s.limits.pauseAfterLosses ? s.limits.pauseAfterLosses.count : null);
    put("l-pause", s.limits.pauseAfterLosses ? s.limits.pauseAfterLosses.minutes : 30);
    put("l-delay", s.execution.delaySec); put("l-slip", s.execution.slippagePct); put("l-prio", s.execution.priorityFee);
  }
  function options() {
    return {seed: Math.max(1, Math.round(num("l-seed") || 1)), coins: Number($("l-coins").value), scenario: $("l-scen").value,
            start: num("l-start") || 10, solUsd: num("l-solusd") || 180};
  }

  // ---------- Test und Anzeige ----------
  let B = null, last = null;
  function run() {
    const v = S.validate(read(), EN);
    const errs = v.errors.filter(e => !/ignoriert|ignored/.test(e.text));
    q("[data-errors]").textContent = errs.map(e => e.text).join(" ");
    const s = v.strategy;
    q("[data-sentence]").textContent = S.describe(s, EN);
    if (!v.ok) return;
    const o = options();
    const r = S.backtest(s, o), h = S.backtest(s, Object.assign({}, o, {hold: true}));
    last = {s, r, o};
    const st = r.stats;
    const tile = (k, v, sub, cls) => `<div class="k-tile"><span class="k">${k}</span><b class="${cls || ""}">${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    q("[data-result]").innerHTML = `<div class="k-tiles">
      ${tile(T.end, fmt(r.end, 3) + " SOL", `Start ${fmt(r.start, 2)} SOL`)}
      ${tile(T.pnl, sol(st.pnl) + " SOL", fmt(st.pnl / r.start * 100, 1) + " %", st.pnl >= 0 ? "gain" : "loss")}
      ${tile(T.hit, pct(st.hit), `${st.wins} / ${st.n}`)}
      ${tile(T.pf, isFinite(st.pf) ? fmt(st.pf, 2) : "∞")}
      ${tile(T.dd, "−" + fmt(st.dd, 3) + " SOL", fmt(st.ddPct * 100, 1) + " %")}
      ${tile(T.trades, String(st.n), T.failed(r.failed) + " · " + T.of(st.n + r.failed, r.coins))}
    </div>
    <p class="lab-line">${T.vsHold(sol(h.stats.pnl))}</p>
    <p class="lab-line">${T.costs(fmt(r.cost.fee, 3), fmt(r.cost.prio, 3), fmt(r.cost.rent, 3))}</p>`;
    chart(r);
    const warn = [];
    if (!st.n && !r.failed) warn.push(T.none);
    else if (st.n < 20) warn.push(T.few(st.n));
    else if ((st.n + r.failed) / r.coins < 0.08) warn.push(T.narrow(fmt((st.n + r.failed) / r.coins * 100, 0)));
    warn.push(T.seeds);
    q("[data-warn]").innerHTML = warn.map(w => `<p>${w}</p>`).join("");
    compare();
    trades(r.trades);
    store.set("pp-lab-current", s);
  }

  function chart(r) {
    const pts = r.equity, W = 640, H = 160, pad = 6;
    const box = q("[data-chart]");
    if (pts.length < 2) { box.innerHTML = ""; return; }
    const tMax = pts[pts.length - 1].t || 1;
    const vs = pts.map(p => p.v), lo = Math.min(...vs, r.start), hi = Math.max(...vs, r.start);
    const x = t => pad + (W - 2 * pad) * t / tMax, y = v => H - pad - (H - 2 * pad) * (v - lo) / ((hi - lo) || 1);
    const line = pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const up = r.end >= r.start;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T.chart}: ${fmt(r.start, 2)} → ${fmt(r.end, 3)} SOL" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${y(r.start).toFixed(1)}" y2="${y(r.start).toFixed(1)}" class="base"/>
      <polyline points="${line}" class="${up ? "gain" : "loss"}"/></svg><p class="k">${T.chart}</p>`;
  }

  function trades(list) {
    const box = q("[data-trades]");
    const row = t => `<tr><td>${esc(t.coin)}</td><td>${usd(t.mcIn)}</td><td>${usd(t.mcOut)}</td><td>${t.reason.split(" + ").map(x => T.reason[x] || x).join(" + ")}</td>
      <td class="${t.pnl >= 0 ? "gain" : "loss"}">${sol(t.pnl)}</td><td>${t.failed ? "–" : fmt(t.ret * 100, 1)}</td><td>${t.failed ? "–" : fmt(t.held / 60, 1) + " " + T.min}</td></tr>`;
    const head = `<thead><tr>${T.cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>`;
    const show = n => `<div class="table-wrap"><table class="k-table">${head}<tbody>${list.slice(0, n).map(row).join("")}</tbody></table></div>`;
    box.innerHTML = list.length ? show(15) + (list.length > 15 ? `<button type="button" class="k-link" data-more>${T.more(list.length)}</button>` : "") : "";
    const more = box.querySelector("[data-more]");
    if (more) more.onclick = () => (box.innerHTML = show(list.length));
  }

  function compare() {
    const box = q("[data-compare]");
    q("[data-act=clear-b]").hidden = !B;
    if (!B || !last) { box.innerHTML = ""; return; }
    const rb = S.backtest(B, last.o), a = last.r.stats, b = rb.stats;
    const rows = [[sol(a.pnl) + " SOL", sol(b.pnl) + " SOL"], [pct(a.hit), pct(b.hit)], [isFinite(a.pf) ? fmt(a.pf, 2) : "∞", isFinite(b.pf) ? fmt(b.pf, 2) : "∞"],
                  ["−" + fmt(a.dd, 3), "−" + fmt(b.dd, 3)], [a.n, b.n]];
    box.innerHTML = `<div class="table-wrap"><table class="k-table"><thead><tr>${T.cmp.map((c, i) => `<th>${i === 2 ? esc(B.name) + " (B)" : i === 1 ? esc(last.s.name) + " (A)" : c}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td>${T.cmpRows[i]}</td><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</tbody></table></div>`;
  }

  // ---------- Speichern, Datei, Link ----------
  const status = text => (q("[data-status]").textContent = text);
  function savedList() {
    const all = store.get("pp-lab-saved", {});
    const sel = $("l-saved"), cur = sel.value;
    sel.innerHTML = `<option value="">${T.noTemplate}</option>` + Object.keys(all).sort().map(n => `<option>${esc(n)}</option>`).join("");
    if (all[cur]) sel.value = cur;
    return all;
  }
  function load(obj, origin) {
    const v = S.validate(obj, EN);
    const errs = v.errors.filter(e => !/ignoriert|ignored/.test(e.text));
    if (!v.strategy || errs.length) {
      status(T.bad + " " + (v.errors.length ? v.errors.map(e => e.text).join(" ") : ""));
      if (!v.strategy) return false;
    }
    write(v.strategy);
    run();
    if (!errs.length) status(T.loaded(v.strategy.name));
    return true;
  }
  const b64 = {
    enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))),
  };
  const copy = (text, msg) => navigator.clipboard?.writeText(text).then(() => status(msg), () => status(text));

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act], [data-template]");
    if (!b) return;
    if (b.dataset.template) { const t = S.clone(S.TEMPLATES[b.dataset.template]); if (EN) t.name = S.TEMPLATE_EN[b.dataset.template]; write(t); run(); return; }
    const s = last ? last.s : read();
    switch (b.dataset.act) {
      case "reroll": $("l-seed").value = 1 + Math.floor(Math.random() * 9999); run(); break;
      case "keep-b": B = S.clone(s); compare(); break;
      case "clear-b": B = null; compare(); break;
      case "save": { const all = store.get("pp-lab-saved", {}); all[s.name] = s; store.set("pp-lab-saved", all); savedList(); $("l-saved").value = s.name; status(T.saved(s.name)); break; }
      case "delete": { const all = store.get("pp-lab-saved", {}), n = $("l-saved").value; if (n && all[n]) { delete all[n]; store.set("pp-lab-saved", all); savedList(); status(T.deleted); } break; }
      case "export": {
        const blob = new Blob([JSON.stringify(s, null, 2) + "\n"], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (s.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "strategie") + ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case "copy": copy(JSON.stringify(s, null, 2), T.copied); break;
      case "link": copy(location.href.split("#")[0] + "#s=" + b64.enc(JSON.stringify(s)), T.linkCopied); break;
      case "paste": load($("l-paste").value, "paste"); break;
    }
  });
  $("l-saved").addEventListener("change", () => { const all = store.get("pp-lab-saved", {}); if (all[$("l-saved").value]) load(all[$("l-saved").value]); });
  q("[data-import]").addEventListener("change", e => { const f = e.target.files[0]; if (f) f.text().then(t => load(t)); e.target.value = ""; });

  // ---------- Eigene CSV ----------
  function parseCsv(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const head = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const col = n => head.indexOf(n);
    if (col("zeit") < 0 || col("seite") < 0) return [];
    const n = (r, k) => Number(String(r[col(k)] ?? "").replace(",", ".")) || 0;
    return lines.slice(1).map(l => l.split(sep)).map(r => ({
      ts: Date.parse(r[col("zeit")]), symbol: r[col("coin")] || "", mint: r[col("mint")] || r[col("coin")] || "", side: r[col("seite")],
      pay: r[col("waehrung")] || "SOL", pnl: n(r, "ergebnis"), ret: n(r, "rendite"), reason: r[col("grund")] || "", mcUsd: n(r, "marktwert_usd"), solUsd: n(r, "sol_usd"),
    })).filter(r => r.ts).sort((a, b) => a.ts - b.ts);
  }
  q("[data-csv]").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(text => {
      const box = q("[data-csv-result]"), rows = parseCsv(text);
      if (!rows.length) { box.innerHTML = `<p class="lab-errors">${T.csvBad}</p>`; return; }
      const r = S.csvTest(last ? last.s : S.validate(read()).strategy, rows);
      box.innerHTML = `<p>${T.csv(T.csvLine(r.all), T.csvLine(r.kept))}</p><p class="k">${T.csvNote}</p>`;
    });
    e.target.value = "";
  });

  // ---------- Start ----------
  let timer = null;
  q("#l-form").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  q(".lab-run").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  q(".lab-run").addEventListener("change", run);
  q("#l-form").addEventListener("submit", e => { e.preventDefault(); run(); });
  savedList();
  const hash = location.hash.match(/^#s=([\w-]+)/);
  let shared = null;
  if (hash) { try { shared = b64.dec(hash[1]); } catch (e) { shared = null; } }
  if (!(shared && load(shared))) {
    const cur = store.get("pp-lab-current", null);
    if (cur) load(cur); else run();
    status("");
  }
})();
