(() => {
  let wanted = {mint: null, trades: [], lines: []};
  let drawn = {key: "", ids: [], symbol: ""};
  let busy = false;

  function chart() {
    const f = document.querySelector("iframe[id^='tradingview']");
    try {
      const api = f && f.contentWindow && f.contentWindow.tradingViewApi;
      return api ? api.activeChart() : null;
    } catch (e) {
      return null;
    }
  }

  function scaleOf(symbol) {
    const s = String(symbol).toUpperCase();
    return {cap: s.includes("MARKET CAP") || s.includes("MCAP"), sol: s.includes("(SOL)")};
  }

  function value(p, sc) {
    const mc = sc.sol ? p.mcSol : p.mcUsd;
    if (mc == null || !isFinite(mc)) return null;
    return sc.cap ? mc : mc / (p.supply || 1e9);
  }

  const OPT = {lock: true, disableSelection: true, disableSave: true, disableUndo: true};

  async function draw() {
    if (busy) return;
    const c = chart();
    if (!c) return;
    let symbol;
    try { symbol = c.symbol(); } catch (e) { return; }
    const key = JSON.stringify(wanted) + symbol;
    const alive = drawn.ids.every(id => { try { return !!c.getShapeById(id); } catch (e) { return false; } });
    if (key === drawn.key && alive) return;
    busy = true;
    try {
      for (const id of drawn.ids) { try { c.removeEntity(id); } catch (e) {} }
      const ids = [];
      if (wanted.mint && symbol.toUpperCase().includes(wanted.mint.toUpperCase())) {
        const sc = scaleOf(symbol);
        for (const t of wanted.trades) {
          const y = value(t, sc);
          if (y == null) continue;
          const buy = t.side === "kauf";
          ids.push(await c.createShape({time: Math.floor(t.ts / 1000), price: y}, {...OPT, shape: buy ? "arrow_up" : "arrow_down", text: t.text,
            overrides: {color: buy ? "#3ddc8c" : "#ff6b6b", arrowColor: buy ? "#3ddc8c" : "#ff6b6b", fontsize: 12, bold: true}}));
        }
        const now = Math.floor(Date.now() / 1000);
        for (const l of wanted.lines) {
          const y = value(l, sc);
          if (y == null) continue;
          ids.push(await c.createShape({time: now, price: y}, {...OPT, shape: "horizontal_line",
            overrides: {linecolor: l.color, linestyle: 2, linewidth: 1, showLabel: true, text: l.text, textcolor: l.color, horzLabelsAlign: "left", vertLabelsAlign: "bottom", fontsize: 11}}));
        }
      }
      drawn = {key, ids: ids.filter(Boolean), symbol};
    } catch (e) {
      drawn = {key: "", ids: drawn.ids, symbol};
    }
    busy = false;
  }

  window.addEventListener("message", e => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== "pump-paper" || d.type !== "marks") return;
    wanted = {mint: String(d.mint || ""), trades: Array.isArray(d.trades) ? d.trades.slice(-40) : [], lines: Array.isArray(d.lines) ? d.lines.slice(0, 4) : []};
    draw();
  });

  setInterval(draw, 1500);
})();
