const DEFAULTS = {
  startSol: 10,
  startUsdc: 1000,
  priority: 0.001,
  buffer: 0,
  delay: 1,
  slippage: 10,
  rent: 0.00204,
  feeOverride: "",
  sizesSol: [0.1, 0.25, 0.5, 1],
  sizesUsdc: [10, 25, 50, 100],
  tp: 60,
  sl: -20,
  maxMin: 10,
  rpc: "https://api.mainnet-beta.solana.com",
  memebotUrl: "",
  memebotPass: "",
  model: 14
};

const BACKUP_RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

function mintFrom(path) {
  const m = path.match(/\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
  return m ? m[1] : null;
}

function payOf(q) {
  return q.quoteSym === "USDC" ? "USDC" : "SOL";
}

function usdOf(cur, q) {
  if (cur === "USDC") return 1;
  if (cur === "SOL") return q.solUsd;
  return q.quoteUsd;
}

function priceOf(q) {
  return q.qRes / q.tRes;
}

function feeOf(q, s) {
  if (s.feeOverride !== "" && s.feeOverride != null && isFinite(Number(s.feeOverride))) return Number(s.feeOverride) / 100;
  const f = q.fees;
  return (f.lp + f.protocol + f.creator) / 10000;
}

function convert(x, from, to, q) {
  if (from === to) return x;
  const a = usdOf(from, q), b = usdOf(to, q);
  return a && b ? x * a / b : null;
}

function buyFill(q, amount, s) {
  const pay = payOf(q);
  const quoteIn = convert(amount, pay, q.quoteSym, q);
  if (quoteIn == null) throw new Error("Kein Kurs für " + q.quoteSym);
  const net = quoteIn / (1 + feeOf(q, s));
  const tokens = q.tRes * net / (q.qRes + net) * (1 - s.buffer / 100);
  return {tokens, cost: amount, fee: convert(quoteIn - net, q.quoteSym, pay, q), pay};
}

function sellFill(q, tokens, s) {
  const pay = payOf(q);
  const gross = q.qRes * tokens / (q.tRes + tokens) * (1 - s.buffer / 100);
  const fee = gross * feeOf(q, s);
  const out = convert(gross - fee, q.quoteSym, pay, q);
  return {amount: Math.max(0, out ?? 0), fee: convert(fee, q.quoteSym, pay, q), pay};
}

function mcOf(q) {
  return priceOf(q) * q.supply;
}

function fmt(x, d = 2) {
  if (x == null || !isFinite(x)) return "–";
  return x.toLocaleString("de-DE", {minimumFractionDigits: d, maximumFractionDigits: d});
}

function fmtPct(x) {
  if (x == null || !isFinite(x)) return "–";
  return (x > 0 ? "+" : "") + fmt(x * 100, 1) + " %";
}

function fmtAmt(x, cur, sign = false) {
  if (x == null || !isFinite(x)) return "–";
  const d = cur === "SOL" ? (Math.abs(x) < 10 ? 3 : 2) : Math.abs(x) < 1 ? 4 : 2;
  return (sign && x > 0 ? "+" : "") + fmt(x, d) + " " + cur;
}

function fmtBoth(x, cur, solUsd, sign = false) {
  if (x == null || !isFinite(x)) return "–";
  if (!solUsd) return fmtAmt(x, cur, sign);
  const sol = cur === "SOL" ? x : x / solUsd;
  const usd = cur === "SOL" ? x * solUsd : x;
  return `${fmtAmt(sol, "SOL", sign)} · ${fmtAmt(usd, "USDC", sign)}`;
}

function fmtBig(x) {
  if (x == null || !isFinite(x)) return "–";
  if (Math.abs(x) >= 1e6) return fmt(x / 1e6, 2) + " Mio.";
  if (Math.abs(x) >= 1e4) return fmt(x / 1e3, 1) + " Tsd.";
  return fmt(x, x < 100 ? 1 : 0);
}
