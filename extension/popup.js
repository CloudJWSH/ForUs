const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const cls = x => x > 0 ? "gain" : x < 0 ? "loss" : "";
const NUM = ["startSol", "startUsdc", "priority", "buffer", "delay", "slippage", "rent", "tp", "sl", "maxMin"];
const TEXT = ["feeOverride", "rpc", "memebotUrl", "memebotPass"];
let st = null;

function send(m) {
  return new Promise((res, rej) => chrome.runtime.sendMessage(m, r => r && r.ok ? res(r.data) : rej(new Error(r ? r.error : "keine Antwort"))));
}

const toUsd = (x, cur, solUsd) => cur === "USDC" ? x : solUsd ? x * solUsd : null;

function worth(p) {
  const q = st.quotes[p.mint];
  if (!q) return null;
  return sellFill(q, p.tokens, st.settings).amount;
}

function drawKonto() {
  const usd = st.solUsd;
  const pos = Object.values(st.positions);
  let openUsd = 0, unreal = 0;
  for (const p of pos) {
    const v = worth(p) ?? p.cost;
    openUsd += toUsd(v, p.pay, usd) || 0;
    unreal += (toUsd(v - p.cost, p.pay, usd) || 0) - (toUsd(p.gas, "SOL", usd) || 0);
  }
  const real = st.history.filter(h => h.side !== "kauf").reduce((a, h) => a + (toUsd(h.pnl || 0, h.pay, h.solUsd || usd) || 0) - (toUsd(h.gas, "SOL", h.solUsd || usd) || 0), 0);
  const total = (toUsd(st.wallet.SOL, "SOL", usd) || 0) + st.wallet.USDC + openUsd;
  const result = real + unreal;
  $("stats").innerHTML = [
    ["Frei SOL", fmtAmt(st.wallet.SOL, "SOL")],
    ["Frei USDC", fmtAmt(st.wallet.USDC, "USDC")],
    ["Gesamtwert", usd ? fmtAmt(total, "USDC") + `<small>${fmtAmt(total / usd, "SOL")}</small>` : "–"],
    ["Ergebnis", usd ? `<span class="${cls(result)}">${fmtAmt(result, "USDC", true)}<small>${fmtAmt(result / usd, "SOL", true)}</small></span>` : "–"],
  ].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join("");
  $("positions").innerHTML = pos.length ? pos.map(p => {
    const v = worth(p), pnl = v == null ? null : v - p.cost, q = st.quotes[p.mint];
    const age = q ? Math.round((Date.now() - q.ts) / 1000) : null;
    return `<li><a href="https://pump.fun/coin/${encodeURIComponent(p.mint)}" target="_blank">$${esc(p.symbol)}</a>
      <span class="r ${cls(pnl)}">${pnl == null ? "–" : fmtAmt(pnl, p.pay, true)} ${p.cost && pnl != null ? `(${fmtPct(pnl / p.cost)})` : ""}</span>
      <small>${fmtBoth(p.cost, p.pay, usd)} eingesetzt · ${Math.round((Date.now() - p.opened) / 60000)} min${age != null ? ` · Kurs vor ${age} s` : ""}</small>
      <span class="r"><button class="sell" data-sell="${esc(p.mint)}">Verkaufen</button></span></li>`;
  }).join("") : `<li class="empty">Keine offene Position. Kaufen geht direkt auf einer Coinseite von pump.fun.</li>`;
}

function drawVerlauf() {
  const usd = st.solUsd;
  const sells = st.history.filter(h => h.side === "verkauf");
  const wins = sells.filter(h => h.pnl > 0).length;
  const pnlUsd = sells.reduce((a, h) => a + (toUsd(h.pnl, h.pay, h.solUsd || usd) || 0), 0);
  const fees = st.history.reduce((a, h) => a + (toUsd(h.fee || 0, h.pay, h.solUsd || usd) || 0) + (toUsd(h.gas || 0, "SOL", h.solUsd || usd) || 0), 0);
  $("hstats").innerHTML = [["Verkäufe", sells.length], ["Treffer", sells.length ? Math.round(wins / sells.length * 100) + " %" : "–"],
    ["Ergebnis", `<span class="${cls(pnlUsd)}">${fmtAmt(pnlUsd, "USDC", true)}${usd ? `<small>${fmtAmt(pnlUsd / usd, "SOL", true)}</small>` : ""}</span>`],
    ["Gebühren + Gas", fmtAmt(fees, "USDC") + (usd ? `<small>${fmtAmt(fees / usd, "SOL")}</small>` : "")]]
    .map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join("");
  $("history").innerHTML = st.history.length ? st.history.slice(-60).reverse().map(h => {
    const when = new Date(h.ts).toLocaleString("de-DE", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
    const fail = h.side === "fehlgeschlagen";
    const right = fail ? `<span class="loss">−${fmtAmt(h.gas, "SOL")}</span>` : h.side === "kauf" ? `−${fmtAmt(h.amount, h.pay)}` : `<span class="${cls(h.pnl)}">${fmtAmt(h.pnl, h.pay, true)} (${fmtPct(h.ret)})</span>`;
    return `<li><a href="https://pump.fun/coin/${encodeURIComponent(h.mint)}" target="_blank">$${esc(h.symbol)}</a><span class="r">${right}</span>
      <small>${when} · ${fail ? "Gescheitert, " + esc(h.reason) : h.side === "kauf" ? "Kauf" + (h.rent ? ", mit Konto-Miete" : "") : "Verkauf, " + esc(h.reason)} · MC ${fmtBig(h.mcUsd)} $ · Gebühr ${fmt(h.feePct, 2)} %</small>
      <small class="r">${fail ? "" : h.side === "verkauf" ? fmtBoth(h.amount, h.pay, h.solUsd || usd) : fmtBoth(h.amount, h.pay, h.solUsd || usd).split(" · ")[1] || ""}</small></li>`;
  }).join("") : `<li class="empty">Noch keine Trades.</li>`;
}

function drawSettings() {
  for (const k of [...NUM, ...TEXT]) if (document.activeElement !== $("s-" + k)) $("s-" + k).value = st.settings[k] ?? "";
  for (const k of ["sizesSol", "sizesUsdc"]) {
    if (document.activeElement !== $("s-" + k)) $("s-" + k).value = st.settings[k].map(x => String(x).replace(".", ",")).join("  ");
  }
}

function draw() {
  if (!st) return;
  drawKonto();
  drawVerlauf();
  drawSettings();
}

async function load() {
  st = await send({op: "get"});
  draw();
  for (const m of Object.keys(st.positions)) send({op: "quote", mint: m}).catch(() => {});
}

document.querySelector("nav").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  document.querySelectorAll("nav button").forEach(x => x.setAttribute("aria-current", x === b));
  document.querySelectorAll("main section").forEach(s => s.hidden = s.id !== b.dataset.tab);
});

$("positions").addEventListener("click", async e => {
  const m = e.target.dataset.sell;
  if (!m) return;
  e.target.disabled = true;
  try { st = await send({op: "sell", mint: m, share: 1}); draw(); } catch (x) { e.target.textContent = x.message; }
});

const list = v => v.split(/[\s;]+/).map(x => Number(x.replace(",", "."))).filter(x => x > 0).slice(0, 6);

$("save").addEventListener("click", async () => {
  const s = {};
  for (const k of NUM) s[k] = Number($("s-" + k).value.replace(",", ".")) || 0;
  for (const k of TEXT) s[k] = $("s-" + k).value.trim();
  s.feeOverride = s.feeOverride.replace(",", ".");
  if (s.sl > 0) s.sl = -s.sl;
  if (!(s.startSol >= 0)) s.startSol = DEFAULTS.startSol;
  s.sizesSol = list($("s-sizesSol").value);
  s.sizesUsdc = list($("s-sizesUsdc").value);
  if (!s.sizesSol.length) s.sizesSol = DEFAULTS.sizesSol;
  if (!s.sizesUsdc.length) s.sizesUsdc = DEFAULTS.sizesUsdc;
  if (!s.rpc) s.rpc = DEFAULTS.rpc;
  try {
    const origin = new URL(s.rpc).origin + "/*";
    const has = await chrome.permissions.contains({origins: [origin]});
    if (!has && !(await chrome.permissions.request({origins: [origin]}))) {
      $("msg").textContent = "Ohne Erlaubnis für diesen RPC geht es nicht, alter RPC bleibt.";
      s.rpc = st.settings.rpc;
    }
  } catch (e) {
    $("msg").textContent = "RPC-Adresse ungültig.";
    return;
  }
  st = await send({op: "settings", settings: s});
  $("msg").textContent = "Gespeichert. Startkapital gilt ab dem nächsten Zurücksetzen.";
  draw();
});

$("reset").addEventListener("click", async () => {
  if ($("reset").dataset.sure !== "1") {
    $("reset").dataset.sure = "1";
    $("reset").textContent = "Wirklich? Noch mal klicken";
    return;
  }
  st = await send({op: "reset"});
  $("reset").dataset.sure = "";
  $("reset").textContent = "Konto zurücksetzen";
  $("msg").textContent = `Zurückgesetzt auf ${fmtAmt(st.wallet.SOL, "SOL")} und ${fmtAmt(st.wallet.USDC, "USDC")}.`;
  draw();
});

$("csv").addEventListener("click", () => {
  const head = ["zeit", "coin", "mint", "seite", "waehrung", "betrag", "tokens", "gebuehr", "gebuehr_prozent", "gas_sol", "ergebnis", "rendite", "grund", "marktwert_usd", "sol_usd"];
  const rows = st.history.map(h => [new Date(h.ts).toISOString(), h.symbol, h.mint, h.side, h.pay, h.amount, h.tokens, h.fee, h.feePct, h.gas,
    h.pnl ?? "", h.ret ?? "", h.reason ?? "", h.mcUsd, h.solUsd].join(";"));
  const blob = new Blob([[head.join(";"), ...rows].join("\n")], {type: "text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pump-paper-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
});

chrome.storage.onChanged.addListener(c => {
  if (c.pp && c.pp.newValue) {
    st = c.pp.newValue;
    st.settings = {...DEFAULTS, ...(st.settings || {})};
    draw();
  }
});

load();
