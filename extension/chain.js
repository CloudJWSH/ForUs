const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const FEE_CONFIG_CURVE = "8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt";
const FEE_CONFIG_POOL = "5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx";
const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ZERO = "11111111111111111111111111111111";

function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("keine gültige Adresse");
    n = n * 58n + BigInt(i);
  }
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 255n);
    n >>= 8n;
  }
  return out;
}

function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s || "1";
}

const P = 2n ** 255n - 19n;
const mod = a => ((a % P) + P) % P;

function powmod(b, e) {
  let r = 1n;
  b = mod(b);
  while (e > 0n) {
    if (e & 1n) r = r * b % P;
    b = b * b % P;
    e >>= 1n;
  }
  return r;
}

const D = mod(-121665n * powmod(121666n, P - 2n));

function onCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
  y = mod(y & ((1n << 255n) - 1n));
  const y2 = y * y % P;
  const x2 = mod(y2 - 1n) * powmod(mod(D * y2 + 1n), P - 2n) % P;
  return x2 === 0n || powmod(x2, (P - 1n) / 2n) === 1n;
}

const text = s => new TextEncoder().encode(s);

async function pda(seeds, program) {
  const prog = b58decode(program);
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), prog, text("ProgramDerivedAddress")];
    const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    if (!onCurve(h)) return b58encode(h);
  }
  throw new Error("keine PDA");
}

const bondingCurve = mint => pda([text("bonding-curve"), b58decode(mint)], PUMP);
const poolAuthority = mint => pda([text("pool-authority"), b58decode(mint)], PUMP);

async function poolAddress(mint, quoteMint) {
  const auth = await poolAuthority(mint);
  return pda([text("pool"), Uint8Array.of(0, 0), b58decode(auth), b58decode(mint), b58decode(quoteMint)], AMM);
}

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.o = 8;
  }
  left(n) { return this.o + n <= this.b.length; }
  u8(d = 0) { if (!this.left(1)) return d; return this.b[this.o++]; }
  bool() { return this.u8() === 1; }
  u16() { const x = this.v.getUint16(this.o, true); this.o += 2; return x; }
  u32() { const x = this.v.getUint32(this.o, true); this.o += 4; return x; }
  u64(d = 0n) { if (!this.left(8)) return d; const x = this.v.getBigUint64(this.o, true); this.o += 8; return x; }
  u128() { const lo = this.u64(), hi = this.u64(); return lo + (hi << 64n); }
  i128(d = 0n) {
    if (!this.left(16)) return d;
    const lo = this.v.getBigUint64(this.o, true), hi = this.v.getBigInt64(this.o + 8, true);
    this.o += 16;
    return lo + (hi << 64n);
  }
  key(d = ZERO) { if (!this.left(32)) return d; const k = b58encode(this.b.slice(this.o, this.o + 32)); this.o += 32; return k; }
}

function decodeCurve(bytes) {
  const r = new Reader(bytes);
  const c = {vtok: r.u64(), vquote: r.u64(), rtok: r.u64(), rquote: r.u64(), supply: r.u64(), complete: r.bool()};
  c.creator = r.key();
  c.mayhem = r.bool();
  c.cashback = r.bool();
  c.quoteMint = r.key();
  c.creatorFeeBps = r.u64();
  if (c.quoteMint === ZERO) c.quoteMint = WSOL;
  return c;
}

function decodePool(bytes) {
  const r = new Reader(bytes);
  const p = {bump: r.u8(), index: r.u16(), creator: r.key(), baseMint: r.key(), quoteMint: r.key(), lpMint: r.key(),
             baseVault: r.key(), quoteVault: r.key(), lpSupply: r.u64(), coinCreator: r.key(), mayhem: r.bool(), cashback: r.bool()};
  p.virtualQuote = r.i128();
  p.creatorFeeBps = r.u64();
  return p;
}

function decodeFees(r) {
  return {lp: Number(r.u64()), protocol: Number(r.u64()), creator: Number(r.u64())};
}

function decodeFeeConfig(bytes) {
  const r = new Reader(bytes);
  r.u8();
  r.key();
  const flat = decodeFees(r);
  const tiers = () => {
    const n = r.left(4) ? r.u32() : 0;
    const out = [];
    for (let i = 0; i < n; i++) out.push({threshold: r.u128(), fees: decodeFees(r)});
    return out;
  };
  const feeTiers = tiers();
  const stableTiers = tiers();
  const exotic = r.left(24) ? decodeFees(r) : flat;
  return {flat, feeTiers, stableTiers, exotic};
}

function tierFees(tiers, marketCap) {
  if (!tiers.length) return null;
  if (marketCap < tiers[0].threshold) return tiers[0].fees;
  for (const t of tiers.slice().reverse()) if (marketCap >= t.threshold) return t.fees;
  return tiers[0].fees;
}

function pickFees(cfg, quoteMint, marketCap, creatorFeeBps, canonical = true) {
  let f;
  if (!canonical) f = cfg.flat;
  else if (quoteMint === WSOL) f = tierFees(cfg.feeTiers, marketCap) || cfg.flat;
  else if (quoteMint === USDC) f = tierFees(cfg.stableTiers, marketCap) || tierFees(cfg.feeTiers, marketCap) || cfg.flat;
  else f = cfg.exotic;
  f = {...f};
  if (quoteMint !== WSOL && quoteMint !== USDC && creatorFeeBps > 0n) f.creator = Number(creatorFeeBps);
  return f;
}

function tokenAmount(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset + 64, 8).getBigUint64(0, true);
}

function mintInfo(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {supply: v.getBigUint64(36, true), decimals: bytes[44]};
}

function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
