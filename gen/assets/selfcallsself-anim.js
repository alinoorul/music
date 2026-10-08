/*
  Self Calls Self: the animation for the Hey Ya recut loop. Green selves come out of one white self, call each
  other with wifi signals, and fold up and fly home into it, in tides.

  On a dex page: a <canvas class="loop-anim"> before this script, and a <loop-audio> player on the same page.
    <canvas class="loop-anim" width="1920" height="1080"></canvas><script src="assets/selfcallsself-anim.js" defer></script>
  The animation runs on its own clock, from the lone self at the start, and does not stop at the end.
  A click on the animation plays or pauses the music. Made from self-calls-self.html: the same scene, without the
  panel, the keys and the export.
*/
(() => {
'use strict';
const cv = document.querySelector('canvas.loop-anim');
if (!cv || !cv.getContext) return;

// ---------- settings ----------
const LOOP = 180;                                      // after the first tide, the scene repeats after this many seconds: 3 different tides
let W = 1920, H = 1080;                                // the canvas size: fit() sets it
const SEED = 7;
const VW = 1920, VH = 1080;                            // the scene is drawn in this space, then scaled
const CX = 960, CY = 545, SELF_H = 190;                // where the centre self stands, and its height in pixels
const WHITE = [255, 255, 255], GREEN = [0, 255, 65];
const PLACE_GAP = 135;                                 // places where a self can stand are scattered at random, at least this far apart
const TIDE = 60;                                       // seconds from one low tide to the next: the screen fills, then empties (low tide: about 8 s)
const BIRTHS = [0.06, 0.64];                           // when selves come out, as a part of the tide (most near the start of this range)
const MERGES = [0.36, 0.925];                          // when selves fold up to go home, as a part of the tide (most near the end)
const RESIDENTS = 6;                                   // places whose short lives come and go round the low tide, so it is never still
const MIN_LIFE = 5;                                    // seconds a self stands at least
const FOLD = 1.2;                                      // seconds a self takes to fold back into a bud, turning white, before it flies home
const CALL_GAP = [5, 12];                              // seconds between the calls a self makes
const WAVE_SPEED = 420;                                // pixels per second for a signal
const LEAD = 0.45;                                     // the wifi arcs light up one by one at the caller's head, then fly
const REPLY_GAP = 0.35;                                // seconds between a signal arriving and the answer leaving

// ---------- small helpers ----------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const win = (t, a, b, d) => smooth(a, a + d, t) * (1 - smooth(b - d, b, t));
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, n) => ((a % n) + n) % n;
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
const osc = (t, f, ph) => Math.sin(2 * Math.PI * (Math.max(1, Math.round(f * LOOP)) / LOOP) * t + ph); // f in Hz, made to fit LOOP
function rng(seed) {                                   // mulberry32: the same seed gives the same animation
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngOf(...xs) {                                // a random stream for one place, one life and one purpose
  let h = (SEED * 2654435761) >>> 0;
  for (const x of xs) h = (Math.imul(h ^ (x + 0x9e3779b9 + (h << 6) + (h >>> 2)), 0x85ebca6b) ^ (h >>> 13)) >>> 0;
  return rng(h);
}
function quad(a, c, b, u) { const v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
function quadTan(a, c, b, u) { const v = 1 - u; return [2 * v * (c[0] - a[0]) + 2 * u * (b[0] - c[0]), 2 * v * (c[1] - a[1]) + 2 * u * (b[1] - c[1])]; }
function bendPoint(a, b, bend) { return [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend]; }
const chest = (f) => [f.x, f.y - 0.05 * f.h];          // a figure's centre is (x, y); its feet are at y + h/2
function flashAt(list, t) {                            // a short brightening after each event: [time, strength]
  let s = 0;
  for (const [te, amp] of list) if (t > te - 0.06 && t < te + 2) s += amp * (t < te ? (t - te + 0.06) / 0.06 : Math.exp(-(t - te) / 0.35));
  return Math.min(1.5, s);
}

// ---------- the places, and the lives at each place ----------
const TN = Math.max(1, Math.round(LOOP / TIDE)), TP = LOOP / TN;   // a whole number of tides in each loop
function build() {
  const R = rng(SEED);
  const self = { id: 0, x: CX, y: CY, h: SELF_H, color: WHITE, ph: 0.4, fq: 1, ups: [], phones: [], flashes: [] };
  const pts = [];                                      // random places over the whole screen, clear of each other and of the centre self
  for (let i = 0; i < 40000; i++) {
    const x = 70 + R() * (VW - 140), y = 80 + R() * (VH - 160);
    if (((x - CX) / 175) ** 2 + ((y - CY) / 195) ** 2 < 1) continue;
    if (pts.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < PLACE_GAP * PLACE_GAP)) continue;
    pts.push({ x, y });
  }
  const slots = pts.map((p, i) => {
    const far = clamp01(Math.hypot((p.x - CX) / 900, (p.y - CY) / 500));   // far from the centre: smaller and dimmer, for depth
    return { id: i + 1, x0: p.x, y0: p.y, h: SELF_H * Math.min(0.6, lerp(0.58, 0.27, far) * (0.88 + 0.24 * R())),
      color: GREEN.map((v) => v * Math.min(1, lerp(1, 0.6, far) * (0.9 + 0.2 * R()))), ph: R() * 6.283, fq: 0.8 + 0.4 * R(),
      resident: false, ups: [], phones: [], flashes: [] };
  });
  for (let k = 0; k < RESIDENTS && k < slots.length; k++) {
    const free = slots.filter((s) => !s.resident);
    free[(R() * free.length) | 0].resident = true;
  }
  slots.sort((p, q) => p.h - q.h);                     // small (far) selves are drawn first, behind the near ones
  for (const s of slots) s.near = slots.filter((o) => o !== s).sort((p, q) => Math.hypot(p.x0 - s.x0, p.y0 - s.y0) - Math.hypot(q.x0 - s.x0, q.y0 - s.y0)).slice(0, 6);
  const dust = [];                                     // dim green points drifting up, for depth
  for (let i = 0; i < 90; i++) dust.push({ x: R() * VW, y: R() * VH, n: 1 + ((R() * 4) | 0), a: 0.04 + R() * 0.12, s: 1.2 + R() * 1.4, ph: R() * 6.283 });
  return { self, sc: chest(self), slots, dust };
}
const S = build();

const early = (R, [a, b]) => b - (b - a) * Math.sqrt(R());          // random in [a, b], most often near a: selves pour out as the tide turns
const late = (R, [a, b]) => a + (b - a) * Math.sqrt(R());           // random in [a, b], most often near b: selves pour home before low tide
const geoms = new Map();
function geom(s, cm) {                                 // the life a place has in tide cm: where, when, how it flies, how long it stands
  const key = s.id * 64 + cm;
  let g = geoms.get(key);
  if (g) return g;
  const R = rngOf(s.id, cm, 11), th = R() * 6.2832, r = R() * 0.2 * PLACE_GAP;  // each life stands a little apart from the last
  const x = s.x0 + r * Math.cos(th), y = s.y0 + r * Math.sin(th) * 0.7, b = [x, y - 0.05 * s.h];
  const fly = 0.45 + Math.hypot(b[0] - S.sc[0], b[1] - S.sc[1]) / 1500;
  const travel = fly * (0.7 + 0.4 * R()), back = fly * (1.2 + 0.4 * R()), growLen = 0.55 + 0.25 * R(); // home is slower than out
  // most selves come out while the tide rises and go home while it falls; residents stay through the low tide
  const xb = s.resident ? 0.78 + 0.17 * R() : early(R, BIRTHS), born = xb * TP;
  const xm = Math.max(s.resident ? 1.03 + 0.17 * R() : late(R, MERGES), xb + (travel + growLen + MIN_LIFE) / TP);
  const latest = (s.resident ? 1.78 : 1 + BIRTHS[0]) * TP - 0.5 - FOLD - back;   // home before this place's next life comes out
  const life = Math.min(xm * TP, latest) - born;
  g = { x, y, travel, back, growLen, grown: travel + growLen, life, home: life + FOLD + back, born,  // home: back inside the centre self
    ctrl: bendPoint(S.sc, b, (R() < 0.5 ? 1 : -1) * (0.04 + 0.3 * R())) };     // a thread with its own curve
  geoms.set(key, g);
  return g;
}
function lifeIn(s, c) { const cm = mod(c, TN), g = geom(s, cm); return { c, cm, start: c * TP + g.born, g }; }
function lifeAt(s, t, pattern) {                       // the latest life at a place born by time t. The video starts with
  const c = Math.floor(t / TP);                        // the centre self alone, so lives born before 0 do not show (pattern: they do)
  for (const cc of [c, c - 1]) { const L = lifeIn(s, cc); if (L.start <= t && (pattern || L.start >= 0)) return L; }
  return null;
}
// The real timeline differs from the repeating pattern only near the start, while lives born before 0 are hidden.
const STEADY = 0.4 * TP + 4;
let lf = STEADY;                                       // LOOP_FROM: from here the scene repeats exactly every LOOP seconds
for (const s of S.slots) for (let c = -1; c * TP < STEADY + TP; c++) { const L = lifeIn(s, c); if (L.start < STEADY) lf = Math.max(lf, L.start + L.g.home + 1); }
const LOOP_FROM = lf;

const okAt = (L, t) => { const u = t - L.start; return u >= L.g.grown + 0.15 && u <= L.g.life - 0.6; };
function aliveOver(s, a, b, pattern) {                 // free to talk from a to b
  const A = lifeAt(s, a, pattern), B = lifeAt(s, b, pattern);
  return !!A && !!B && A.c === B.c && okAt(A, a) && okAt(B, b);
}
const travelOf = (a, b) => Math.max(0.5, Math.hypot((a.x0 ?? a.x) - (b.x0 ?? b.x), (a.y0 ?? a.y) - (b.y0 ?? b.y)) / WAVE_SPEED);
const spanOf = (a, b, n) => n * (LEAD + travelOf(a, b)) + (n - 1) * REPLY_GAP;

const callCache = new Map();
function callsOf(s, L) {                               // the calls one life makes: first to the centre self, then to others
  const real = L.start < STEADY;                       // lives near the start are worked out in the real timeline
  const key = (real ? 'r' + L.c : 'p' + L.cm) + ':' + s.id;
  let list = callCache.get(key);
  if (list) return list;
  list = [];
  const g = L.g, R = rngOf(s.id, L.cm, real ? L.c + 5000 : 0, 23), start = real ? L.start : L.cm * TP + g.born;
  let u = g.grown + 0.15, first = true;
  for (let guard = 0; guard < 40; guard++) {
    const n = 2 + (R() < 0.35 ? 1 : 0), bend = (R() - 0.5) * 0.2;
    let to = S.self;
    if (!first && R() >= 0.2) {
      to = null;
      const near = R() < 0.6;
      for (let k = 0; k < 4 && !to; k++) {
        const c = near ? s.near[(R() * s.near.length) | 0] : S.slots[(R() * S.slots.length) | 0];
        if (c !== s && aliveOver(c, start + u - 0.3, start + u + spanOf(s, c, n) + 0.3, !real)) to = c;
      }
      if (!to) to = S.self;
    }
    const d = spanOf(s, to, n);
    if (u + d > g.life - 0.6) break;
    list.push({ rel: u, n, to, bend, travel: travelOf(s, to), dur: d });
    first = false;
    u += d + CALL_GAP[0] + R() * (CALL_GAP[1] - CALL_GAP[0]);
  }
  callCache.set(key, list);
  return list;
}

// ---------- everything that is going on at time t ----------
function prepare(t) {
  cache = new Map();
  const self = S.self, sig = [];
  self.ups = []; self.flashes = [];
  for (const s of S.slots) {                           // first every self's place in its life, then the calls between them
    const L = lifeAt(s, t);
    s.L = L; s.on = !!L;
    if (!L) continue;
    s.u = t - L.start; s.g = L.g; s.x = L.g.x; s.y = L.g.y;
    s.ups = []; s.phones = []; s.flashes = [];       // no flash when a self comes out or goes home
  }
  for (const s of S.slots) {
    if (!s.on) continue;
    for (const k of callsOf(s, s.L)) {
      const a = s.L.start + k.rel, e = a + k.dur;
      if (t < a - 0.4 || t > e + 0.9) continue;
      for (let i = 0; i < k.n; i++) {
        const t0 = a + i * (LEAD + k.travel + REPLY_GAP), t1 = t0 + LEAD + k.travel;
        const from = i % 2 ? k.to : s, to = i % 2 ? s : k.to;
        if (t >= t0 && t <= t1 + 0.9) sig.push({ from, to, t0, t1, bend: i % 2 ? -k.bend : k.bend });
      }
      s.phones.push([a - 0.35, e + 0.35, Math.sign(k.to.x - s.x) || 1]);
      if (k.to !== self) k.to.phones.push([a + LEAD + k.travel - 0.4, e + 0.35, Math.sign(s.x - k.to.x) || 1]);
    }
  }
  return { sig };
}

// ---------- one stick figure: joints from the pose at time t ----------
function ik(s, t, l1, l2, out) {                       // two-bone limb; the middle joint bends outward
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [s[0] + l1 * Math.cos(th + a), s[1] + l1 * Math.sin(th + a)], e2 = [s[0] + l1 * Math.cos(th - a), s[1] + l1 * Math.sin(th - a)];
  return [(e1[0] - e2[0]) * out >= 0 ? e1 : e2, [s[0] + d * Math.cos(th), s[1] + d * Math.sin(th)]];
}
let cache = new Map();
function joints(f, t) {
  const hit = cache.get(f);
  if (hit) return hit;
  let wu = 0, wp = 0, side = 1;
  for (const [a, b] of f.ups) wu = Math.max(wu, win(t, a, b, 0.3));
  for (const [a, b, sd] of f.phones) { const w = win(t, a, b, 0.35); if (w > wp) { wp = w; side = sd; } }
  const q = f.fq, breath = osc(t, 0.35 * q, f.ph) * 0.006, swing = osc(t, 0.27 * q, f.ph) * 0.02;
  const sway = osc(t, 0.14 * q, f.ph * 1.7) * 0.025 + side * wp * 0.07, bob = osc(t, 0.22 * q, f.ph) * 0.012;
  const sh = [0, -0.72 + breath], hip = [0, -0.37];
  let hL = [lerp(-0.2 - swing, -0.34, wu), lerp(-0.38, -1.06, wu)], hR = [lerp(0.2 + swing, 0.34, wu), lerp(-0.38, -1.06, wu)];
  const ear = [side * 0.13, -0.865 + breath];
  if (side > 0) hR = [lerp(hR[0], ear[0], wp), lerp(hR[1], ear[1], wp)];
  else hL = [lerp(hL[0], ear[0], wp), lerp(hL[1], ear[1], wp)];
  const [eL, hl] = ik(sh, hL, 0.2, 0.21, -1), [eR, hr] = ik(sh, hR, 0.2, 0.21, 1);
  const [kL, fl] = ik(hip, [-0.12, 0], 0.2, 0.2, -1), [kR, fr] = ik(hip, [0.12, 0], 0.2, 0.2, 1);
  const c = Math.cos(sway), sn = Math.sin(sway), s = f.h, ox = f.x, oy = f.y + 0.5 * f.h - bob * f.h;
  const P = (u) => [ox + (u[0] * c - u[1] * sn) * s, oy + (u[0] * sn + u[1] * c) * s];
  const J = { wp, side, head: P([0, -0.875 + breath]), headR: 0.105 * s, neck: P([0, -0.77 + breath]), sh: P(sh),
    hip: P(hip), chest: P([0, -0.55]), elbowL: P(eL), handL: P(hl), elbowR: P(eR), handR: P(hr),
    kneeL: P(kL), footL: P(fl), kneeR: P(kR), footR: P(fr) };
  cache.set(f, J);
  return J;
}

// ---------- drawing ----------
const ctx = cv.getContext('2d', { alpha: false });
let SC = 1, OX = 0, OY = 0;                            // from the scene to the canvas: fit() sets them

function partial(pts, k) {                             // a polyline drawn up to the fraction k of its length
  if (k <= 0) return;
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
  let left = total * Math.min(1, k);
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const u = Math.min(1, left / (lens[i - 1] || 1));
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
    left -= lens[i - 1];
  }
}

function glowStroke(color, alpha, lw, glow) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, glow * alpha * 1.6); ctx.lineWidth = lw * 2.8; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = lw; ctx.stroke();
}

function drawFigure(f, t) {
  const isSelf = f === S.self;
  // a green self unfolds out of its bud, and at the end of its life folds back into the bud the same way
  const g = isSelf ? 1 : clamp01((f.u - f.g.travel) / f.g.growLen) * (1 - easeOut(clamp01((f.u - f.g.life) / FOLD)));
  if (g <= 0) return;
  const J = joints(f, t), fl = flashAt(f.flashes, t), lw = Math.max(1.4, f.h * 0.032);
  const kSpine = easeOut(clamp01(g / 0.3)), kHead = clamp01((g - 0.25) / 0.45);
  const kArm = easeOut(clamp01((g - 0.3) / 0.45)), kLeg = easeOut(clamp01((g - 0.4) / 0.5));
  const folding = isSelf ? 0 : clamp01((f.u - f.g.life) / FOLD);   // a self turns white as it folds up to go home
  const color = isSelf ? f.color : mix(f.color, WHITE, Math.max(0.55 * Math.min(1, fl), 0.85 * folding));
  if (kHead >= 1) {                                    // the head is solid black inside, so lines behind it stop at its edge
    ctx.beginPath(); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832);
    ctx.fillStyle = '#000'; ctx.fill();
  }
  ctx.beginPath();
  partial([J.chest, J.neck], kSpine); partial([J.chest, J.hip], kSpine);
  partial([J.sh, J.elbowL, J.handL], kArm); partial([J.sh, J.elbowR, J.handR], kArm);
  partial([J.hip, J.kneeL, J.footL], kLeg); partial([J.hip, J.kneeR, J.footR], kLeg);
  if (kHead > 0) {
    const a0 = Math.PI / 2;
    ctx.moveTo(J.head[0] + J.headR * Math.cos(a0), J.head[1] + J.headR * Math.sin(a0));
    ctx.arc(J.head[0], J.head[1], J.headR, a0, a0 + 6.2832 * kHead);
  }
  if (J.wp > 0.25 && kArm >= 1) {                      // a phone at the ear
    const hand = J.side > 0 ? J.handR : J.handL, len = 0.075 * f.h * J.wp;
    ctx.moveTo(hand[0], hand[1] - len); ctx.lineTo(hand[0], hand[1] + len);
  }
  glowStroke(color, 1, lw, isSelf ? 0.1 : 0.1 + 0.25 * fl);
  if (!isSelf && g < 0.5) {                            // the bud this self comes out of, and folds back into: the bud in flight, no flash
    const k = 1 - g * 2, r = 3 + 1.6 * f.h / SELF_H, col = mix(f.color, WHITE, folding > 0 ? 0.85 : 0.2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(col, 0.22 * k); ctx.beginPath(); ctx.arc(J.chest[0], J.chest[1], r * 3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = rgba(col, k); ctx.beginPath(); ctx.arc(J.chest[0], J.chest[1], r, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawThreads() {                               // the thread from the centre self to each green self, and the buds on it
  const a = S.sc;
  ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
  ctx.globalCompositeOperation = 'lighter';
  for (const s of S.slots) {
    if (!s.on) continue;
    const g = s.g, b = chest(s), u = s.u;
    if (u > g.home) continue;
    let k, bud = -1, alpha;                            // k: how far the thread reaches out; bud: where the bud is on it
    if (u < g.travel) { k = bud = easeInOut(u / g.travel); alpha = 0.4; }                       // flying out
    else if (u < g.life) { k = 1; alpha = lerp(0.5, 0.05, smooth(g.travel, g.travel + 1.5, u)); } // alive
    else if (u < g.life + FOLD) { k = 1; alpha = lerp(0.05, 0.55, smooth(g.life, g.life + FOLD, u)); } // folding up
    else { k = bud = 1 - easeInOut((u - g.life - FOLD) / g.back); alpha = 0.65; }                 // flying home: slower, brighter
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = quad(a, g.ctrl, b, k * i / 24); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.strokeStyle = rgba(s.color, alpha); ctx.stroke();
    if (bud < 0) continue;
    const home = u >= g.life, col = home ? mix(s.color, WHITE, 0.85) : mix(s.color, WHITE, 0.75 * (1 - bud)); // a bud going home is white
    const tail = home ? 12 : 5;
    for (let j = tail; j >= 1; j--) {                  // a tail of points behind the bud: longer on the way home
      const q = bud + (home ? 1 : -1) * j * 0.02;
      if (q < 0 || q > 1) continue;
      const p = quad(a, g.ctrl, b, q);
      ctx.fillStyle = rgba(col, (home ? 0.65 : 0.45) * (1 - j / (tail + 1))); ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
    }
    const p = quad(a, g.ctrl, b, bud), r = (home ? 4.2 : 3) + 1.6 * s.h / SELF_H;
    ctx.fillStyle = rgba(col, 0.28); ctx.beginPath(); ctx.arc(p[0], p[1], r * 3.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = rgba(mix(col, WHITE, 0.5), 1); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawWifi(p, dir, s, col, alpha, t, reveal) { // a wifi symbol: a dot, and three arcs that open toward dir
  if (alpha <= 0.003) return;
  const core = col === WHITE ? col : mix(col, WHITE, 0.1);   // green selves send green signals, the centre self white
  ctx.fillStyle = rgba(core, alpha);
  ctx.beginPath(); ctx.arc(p[0], p[1], 2 + 0.5 * s, 0, 6.2832); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const v = clamp01(reveal - k);
    if (v <= 0) continue;
    const beat = 0.6 + 0.4 * Math.max(0, osc(t, 1.2, -2 * Math.PI * k / 3));
    ctx.beginPath(); ctx.arc(p[0], p[1], (6 + 6 * k) * s, dir - 0.78, dir + 0.78);
    ctx.strokeStyle = rgba(col, alpha * v * 0.16); ctx.lineWidth = 3 + 2.5 * s; ctx.stroke();
    ctx.strokeStyle = rgba(core, alpha * v * beat * 0.9); ctx.lineWidth = 1.2 + 0.7 * s; ctx.stroke();
  }
}

function drawWaves(now, t) {                           // only the wifi signals: no lines between the callers
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const w of now.sig) {
    const A = joints(w.from, t), B = joints(w.to, t), base = 0.7 + 0.5 * w.from.h / SELF_H;
    const dx = B.head[0] - A.head[0], dy = B.head[1] - A.head[1], d = Math.hypot(dx, dy) || 1;
    const a = [A.head[0] + dx / d * A.headR * 1.3, A.head[1] + dy / d * A.headR * 1.3];
    const stop = B.headR * 1.3 + 8, b = [B.head[0] - dx / d * stop, B.head[1] - dy / d * stop];
    const m = bendPoint(a, b, w.bend), col = w.from.color;
    if (t <= w.t1) {                                   // the arcs light up at the caller's head, then fly and widen with distance
      const u = clamp01((t - w.t0 - LEAD) / (w.t1 - w.t0 - LEAD)), p = quad(a, m, b, u), tg = quadTan(a, m, b, u);
      const size = base * Math.min(2.6, 0.75 + u * d / 480);
      drawWifi(p, Math.atan2(tg[1], tg[0]), size, col, 1 - smooth(0.92, 1, u), t, (t - w.t0) / LEAD * 3);
    }                                                  // it fades as it reaches the listener: no ring
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawDust(t) {
  for (const d of S.dust) {
    const x = d.x + osc(t, 0.032, d.ph) * 14, y = mod(d.y - VH * d.n * t / LOOP, VH);
    ctx.fillStyle = rgba(GREEN, d.a * (0.7 + 0.3 * osc(t, 0.19, d.ph)));
    ctx.fillRect(x, y, d.s, d.s);
  }
}

function render(t) {
  const now = prepare(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(SC, 0, 0, SC, OX, OY);
  drawDust(t);
  drawThreads();
  drawWaves(now, t);
  for (const s of S.slots) if (s.on) drawFigure(s, t);   // far selves first
  drawFigure(S.self, t);
}

// ---------- on the dex page: fit the canvas, keep time, draw each frame ----------
const still = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let player = null;
const music = () => player || (player = document.querySelector('loop-audio'));
const playing = () => { const p = music(); return !!(p && p.playing); };

function fit() {                                       // as sharp as the screen, but not more than the scene needs
  const box = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.min(VW, Math.round(box.width * dpr))), h = Math.round(w * VH / VW);
  if (w === cv.width && h === cv.height) return false;
  cv.width = W = w; cv.height = H = h;
  SC = Math.min(W / VW, H / VH); OX = (W - VW * SC) / 2; OY = (H - VH * SC) / 2;
  return true;
}

const STILL_AT = 40;                                   // with reduced motion: a still frame with many selves
// The scene runs on its own clock: it does not follow the music. With reduced motion, it moves only while the music plays.
let last = still.matches ? STILL_AT : 0, from = last, at = performance.now();
function timeAt(ms) {
  if (still.matches && !playing()) { from = last; at = ms; return last; }
  return (last = from + Math.max(0, ms - at) / 1000);
}

let dirty = true, shown = true, drawn = NaN;
if (window.ResizeObserver) new ResizeObserver(() => { dirty = true; }).observe(cv);
else addEventListener('resize', () => { dirty = true; });
if (window.IntersectionObserver) new IntersectionObserver((es) => { shown = es[es.length - 1].isIntersecting; }).observe(cv);
function frame(ms) {
  requestAnimationFrame(frame);
  const t = timeAt(ms);
  if (!shown) return;                                  // off the screen: keep time, draw nothing
  if (dirty) { dirty = false; if (fit()) drawn = NaN; }
  if (t !== drawn) { render(t); drawn = t; }
}
cv.addEventListener('click', () => { const p = music(); if (p && p.toggle) p.toggle(); });   // a click on the animation plays or pauses the music
cv.loopAnim = { time: () => last, render };            // for tests
requestAnimationFrame(frame);
})();
