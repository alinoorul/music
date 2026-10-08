/*
  Obsolete: the animation for the Obsolete recut loop. A white self calls a green self that does not answer; each
  version of its love calls too, gets no answer, is labelled "__obsolete" and sinks through the glass floor.

  On a dex page: a <canvas class="loop-anim">, and a <loop-audio> player in the same parent (else the first on the page).
    <span class="loop-stage"><canvas class="loop-anim" width="1920" height="1080"></canvas><loop-audio ...>Name</loop-audio></span>
    <script src="assets/obsolete-anim.js" defer></script>
  The animation moves only while the music plays, and follows it to the beat. When the music pauses, it stops.
  A click on the animation plays or pauses the music. Made from obsolete.html: the same scene, without the
  panel, the keys and the export.
  Josefin Sans (SIL Open Font License 1.1) comes from josefin-sans.woff2 next to this script.
*/
(() => {
'use strict';
const cv = document.querySelector('canvas.loop-anim');
if (!cv || !cv.getContext) return;
const HERE = document.currentScript ? document.currentScript.src : location.href;
// ---------- settings ----------
const BPM = 103.784;                                   // measured from obsolete_loop_2.mp3
const OFFSET = -0.771;                                 // the start of a loop, in seconds: before the file starts
const BARS = 8;                                        // bars in one loop: me sends a new version every BARS / 4 bars
const LOOPS = 5;                                          // loops in one video loop: 5 loops are the 92.5 s of the file
// measured from obsolete_loop_2.mp3 on each half beat of one 8-bar loop, 0..1: the kick and bass, and the voice range
const GROOVE = [0.7, 0.14, 0.19, 0.76, 0.01, 0.01, 0.07, 0.06, 0.83, 0.19, 0.07, 0.54, 0.01, 0.0, 0.29, 0.59, 0.69, 0.21, 0.05, 0.36, 0.02, 0.02, 0.15, 0.26, 0.65, 0.22, 0.09, 0.84, 0.15, 0.6, 0.37, 0.76, 0.73, 0.19, 0.14, 0.75, 0.02, 0.0, 0.28, 0.32, 0.79, 0.31, 0.1, 0.81, 0.01, 0.0, 0.4, 0.54, 0.67, 0.13, 0.08, 0.11, 0.29, 0.3, 0.36, 0.29, 0.76, 0.23, 0.13, 1.0, 0.09, 0.65, 0.48, 0.48];
const VOICE = [0.28, 0.4, 0.13, 0.04, 0.15, 0.1, 0.05, 0.0, 0.17, 0.23, 0.11, 0.21, 0.28, 0.19, 0.22, 0.06, 0.16, 0.28, 0.82, 0.54, 0.9, 0.7, 0.7, 0.76, 0.42, 0.57, 0.34, 0.33, 0.62, 0.44, 0.64, 0.6, 0.37, 0.38, 0.26, 0.2, 0.23, 0.18, 0.2, 0.13, 0.2, 0.35, 0.28, 0.45, 0.5, 0.46, 0.46, 0.36, 0.47, 0.62, 1.0, 0.83, 0.94, 0.79, 0.71, 0.73, 0.54, 0.75, 0.88, 0.59, 0.83, 0.69, 0.84, 0.61];
let W = 1920, H = 1080;                                // the canvas size: fit() sets it
const SEED = 7;
const SHOW_TITLE = true;
const TITLE_Y = 0.25;                                  // the middle of the title's letters, as a part of the height from the top
const VW = 1920, VH = 1080, FLOOR = 790;              // the scene is drawn in this space; the glass floor is at y = FLOOR
const WHITE = [255, 255, 255], GREEN = [0, 255, 65], DIM = [70, 150, 90];
const MONO = "'Josefin Sans', sans-serif", SANS = MONO;   // all text is Josefin Sans
const fontReady = (() => {                             // Josefin Sans, from the file next to this script
  try {
    const face = new FontFace('Josefin Sans', 'url(' + new URL('josefin-sans.woff2', HERE).href + ')', { weight: '100 700' });
    document.fonts.add(face);
    return Promise.race([face.load(), new Promise((ok) => setTimeout(ok, 4000))]).catch(() => {});
  } catch (e) { return Promise.resolve(); }
})();
const ME = { x: 620, feet: FLOOR, h: 272, color: WHITE, ph: 0.3 };   // the white self
const YOU = { x: 1300, feet: FLOOR, h: 258, color: GREEN, ph: 2.1 }; // the green self that does not answer
const LEAD = 0.35;                                     // beats the wifi arcs take to light up before a signal flies

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
function rng(seed) {                                   // mulberry32: the same seed gives the same animation
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngOf(...xs) {                                // a random stream for one thing
  let h = (SEED * 2654435761) >>> 0;
  for (const x of xs) h = (Math.imul(h ^ (x + 0x9e3779b9 + (h << 6) + (h >>> 2)), 0x85ebca6b) ^ (h >>> 13)) >>> 0;
  return rng(h);
}
function quad(a, c, b, u) { const v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
function quadTan(a, c, b, u) { const v = 1 - u; return [2 * v * (c[0] - a[0]) + 2 * u * (b[0] - c[0]), 2 * v * (c[1] - a[1]) + 2 * u * (b[1] - c[1])]; }
function bendPoint(a, b, bend) { return [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend]; }
const chest = (f) => [f.x, f.feet - 0.55 * f.h];

// ---------- the beat ----------
const CB = BARS * 4;                                   // beats in one loop
const STEP = CB / 4;                                   // beats between two versions of love
const beatOf = (t) => (t - OFFSET) * BPM / 60;        // beats since the first downbeat
const pulse = (B) => {                                 // the groove: high on each hit of the kick and bass, then falling fast
  const h = B * 2, i = Math.floor(h), fr = h - i;
  return GROOVE[mod(i, 64)] * Math.exp(-fr * 3) + 0.5 * GROOVE[mod(i - 1, 64)] * Math.exp(-(fr + 1) * 3);
};
const voiceAt = (B) => VOICE[mod(Math.floor(B * 2), 64)];
const periodS = () => CB * LOOPS * 60 / BPM;          // seconds until the whole scene repeats
const osc = (t, f, ph) => { const P = periodS(); return Math.sin(2 * Math.PI * Math.max(1, Math.round(f * P)) / P * t + ph); }; // f in Hz, made to fit

// ---------- one stick figure ----------
function ik(s, t, l1, l2, out) {                       // two-bone limb; the middle joint bends outward
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [s[0] + l1 * Math.cos(th + a), s[1] + l1 * Math.sin(th + a)], e2 = [s[0] + l1 * Math.cos(th - a), s[1] + l1 * Math.sin(th - a)];
  return [(e1[0] - e2[0]) * out >= 0 ? e1 : e2, [s[0] + d * Math.cos(th), s[1] + d * Math.sin(th)]];
}
// p: wu (arms up), wp and side (phone at one ear), slump (head and arms drop), beat (how much it dips on the beat),
// smooth (a soft bob on each beat in place of the dip on each hit: for the two big selves)
function jointsOf(f, p, t) {
  const B = beatOf(t), ph = f.ph || 0, wu = p.wu || 0, wp = p.wp || 0, side = p.side || 1, sl = p.slump || 0;
  const breath = osc(t, 0.33, ph) * 0.006, swing = osc(t, 0.25, ph) * 0.02 * (1 - sl);
  const sway = osc(t, 0.13, ph * 1.7) * 0.02 + side * wp * 0.06;
  const dip = (p.smooth ? 0.014 * (0.5 + 0.5 * Math.cos(2 * Math.PI * B))     // a soft bob, lowest on each beat, never a jerk
    : 0.024 * pulse(B) * (p.beat ?? 1)) + 0.04 * sl;   // small selves dip with the kick and bass by bending the knees
  const sh = [0, -0.72 + breath + dip], hip = [0, -0.37 + dip * 0.8], head = [0.025 * sl, -0.875 + breath + dip + 0.05 * sl];
  let hL = [lerp(-0.2 - swing, -0.34, wu), lerp(-0.38, -1.06, wu)], hR = [lerp(0.2 + swing, 0.34, wu), lerp(-0.38, -1.06, wu)];
  hL = [lerp(hL[0], -0.1, sl), lerp(hL[1], -0.31, sl)]; hR = [lerp(hR[0], 0.1, sl), lerp(hR[1], -0.31, sl)];
  const ear = [side * 0.13, head[1] + 0.01];
  if (side > 0) hR = [lerp(hR[0], ear[0], wp), lerp(hR[1], ear[1], wp)];
  else hL = [lerp(hL[0], ear[0], wp), lerp(hL[1], ear[1], wp)];
  const [eL, hl] = ik(sh, hL, 0.2, 0.21, -1), [eR, hr] = ik(sh, hR, 0.2, 0.21, 1);
  const [kL, fl] = ik(hip, [-0.12, 0], 0.2, 0.2, -1), [kR, fr] = ik(hip, [0.12, 0], 0.2, 0.2, 1);
  const c = Math.cos(sway), sn = Math.sin(sway), s = f.h;
  const P = (u) => [f.x + (u[0] * c - u[1] * sn) * s, f.feet + (u[0] * sn + u[1] * c) * s];
  return { wp, side, head: P(head), headR: 0.105 * s, neck: P([0, -0.77 + breath + dip]), sh: P(sh), hip: P(hip),
    chest: P([0, -0.55 + dip]), elbowL: P(eL), handL: P(hl), elbowR: P(eR), handR: P(hr), kneeL: P(kL), footL: P(fl), kneeR: P(kR), footR: P(fr) };
}

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

// grow: 0..1, how far the figure has unfolded out of its bud (or folded back into it)
function drawStick(f, J, color, alpha, grow = 1) {
  if (grow <= 0 || alpha <= 0) return;
  const lw = Math.max(1.4, f.h * 0.032);
  const kSpine = easeOut(clamp01(grow / 0.3)), kHead = clamp01((grow - 0.25) / 0.45);
  const kArm = easeOut(clamp01((grow - 0.3) / 0.45)), kLeg = easeOut(clamp01((grow - 0.4) / 0.5));
  if (kHead >= 1) { ctx.beginPath(); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832); ctx.fillStyle = rgba([0, 0, 0], alpha); ctx.fill(); }
  ctx.beginPath();
  partial([J.chest, J.neck], kSpine); partial([J.chest, J.hip], kSpine);
  partial([J.sh, J.elbowL, J.handL], kArm); partial([J.sh, J.elbowR, J.handR], kArm);
  partial([J.hip, J.kneeL, J.footL], kLeg); partial([J.hip, J.kneeR, J.footR], kLeg);
  if (kHead > 0) {
    ctx.moveTo(J.head[0], J.head[1] + J.headR);
    ctx.arc(J.head[0], J.head[1], J.headR, Math.PI / 2, Math.PI / 2 + 6.2832 * kHead);
  }
  if (J.wp > 0.25 && kArm >= 1) {                      // a phone at the ear
    const hand = J.side > 0 ? J.handR : J.handL, len = 0.075 * f.h * J.wp;
    ctx.moveTo(hand[0], hand[1] - len); ctx.lineTo(hand[0], hand[1] + len);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.16 * alpha); ctx.lineWidth = lw * 2.8; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = lw; ctx.stroke();
  if (grow < 0.5) {                                    // the bud this figure comes out of
    const r = 3 + 1.6 * f.h / 250, k = 1 - grow * 2;
    ctx.fillStyle = rgba(color, alpha * k); ctx.beginPath(); ctx.arc(J.chest[0], J.chest[1], r, 0, 6.2832); ctx.fill();
  }
}

function drawWifi(p, dir, s, col, alpha, t, reveal) { // a wifi symbol: a dot, and three arcs that open toward dir
  if (alpha <= 0.003) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(p[0], p[1], 2 + 0.5 * s, 0, 6.2832); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const v = clamp01(reveal - k);
    if (v <= 0) continue;
    const beat = 0.6 + 0.4 * Math.max(0, Math.sin(2 * Math.PI * (beatOf(t) - k / 3)));   // the arcs pulse on the beat
    ctx.beginPath(); ctx.arc(p[0], p[1], (6 + 6 * k) * s, dir - 0.78, dir + 0.78);
    ctx.strokeStyle = rgba(col, alpha * v * 0.16); ctx.lineWidth = 3 + 2.5 * s; ctx.stroke();
    ctx.strokeStyle = rgba(col, alpha * v * beat * 0.9); ctx.lineWidth = 1.2 + 0.7 * s; ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- what is happening at time t ----------
const VERSIONS = 4 * LOOPS;                            // versions in one video loop: then the numbers start again
const vName = (k) => { const n = mod(k, VERSIONS); return 'love v' + (1 + Math.floor(n / 10)) + '.' + (n % 10); };
function version(k, b) {                               // version k of my love, b beats after it was sent out
  const R = rngOf(mod(k, VERSIONS), 1), s = STEP / 8; // its timeline is in eighths of STEP (8 beats in an 8-bar loop)
  const h = ME.h * (0.46 + 0.12 * R()), x = lerp(830, 1120, R()), bend = (R() < 0.5 ? -1 : 1) * (0.15 + 0.2 * R());
  const v = { k, b, h, x, feet: FLOOR, ph: R() * 6.28, bend, lurkX: lerp(YOU.x - 260, YOU.x + 300, R()), s };
  v.fly = 1.5 * s; v.grown = 2.5 * s; v.tag = [10 * s, 12 * s]; v.sink = [12 * s, 16 * s]; v.gone = 40 * s;
  v.calls = [3, 5, 7, 9].map((c) => c * s);
  return v;
}
function versionsAt(B) {
  const out = [];
  for (let k = Math.floor((B - 40 * STEP / 8) / STEP); k <= Math.floor(B / STEP); k++) {
    const b = B - k * STEP;
    if (b >= 0 && b < 40 * STEP / 8) out.push(version(k, b));
  }
  return out;
}
function burstOf(c) {                                  // the selves me sends out after you answer, in loop c
  const R = rngOf(mod(c, LOOPS), 2), list = [], N = 11;
  const free = [[110, ME.x - 170], [ME.x + 170, YOU.x - 150], [YOU.x + 150, 1810]];   // the floor, without me and you
  const total = free.reduce((a, [p, q]) => a + q - p, 0);
  for (let i = 0; i < N; i++) {
    let d = (i + 0.5 + (R() - 0.5) * 0.6) / N * total, x = free[0][0];   // spread evenly, each a little off its mark
    for (const [p, q] of free) { if (d <= q - p) { x = p + d; break; } d -= q - p; }
    list.push({ x, h: ME.h * (0.3 + 0.2 * R()), feet: FLOOR, ph: R() * 6.28, bend: (R() < 0.5 ? -1 : 1) * (0.1 + 0.3 * R()),
      delay: R() * 0.5, to: (i + 1 + ((R() * (N - 2)) | 0)) % N, talk: R() * 1.6 });
  }
  return list;
}

function scene(t) {                                    // every figure, signal and thread at time t
  const B = beatOf(t), q = CB / 32, c = Math.floor(B / CB), cb = B - c * CB;
  const A0 = c * CB + 0.75 * CB;                       // you answer here, once in each loop
  const sig = [], threads = [], up = [], under = [];
  const me = { f: ME, p: { wu: 0, smooth: true } }, you = { f: YOU, p: { wp: 0, side: -1, smooth: true } };
  // you: the phone comes up only to answer
  you.p.wp = win(B, A0 - 1 * q, A0 + 2.5 * q, 0.6 * q);
  // me: arms up when the answer arrives
  const arrive = A0 + LEAD * q + 1.5 * q;
  me.p.wu = win(B, arrive - 0.2 * q, arrive + 1.4 * q, 0.5 * q);
  // me calls you on every second beat, and on every beat while the voice is strong; not while you answer
  for (let e = Math.floor(B); e > B - 2.6; e--) {
    const ec = mod(e, CB), v = Math.max(voiceAt(e), voiceAt(e + 0.5));
    if (ec >= 0.75 * CB - 2 * q || (mod(e, 2) !== 0 && v < 0.6)) continue;
    sig.push({ from: ME, to: YOU, t0: e, t1: e + LEAD + 1.6, col: WHITE, size: 1.2 + 0.9 * v });
  }
  // your one answer
  if (B >= A0 && B <= arrive) sig.push({ from: YOU, to: ME, t0: A0, t1: arrive, col: GREEN, size: 1.9, beatScale: q });
  // the versions of my love
  for (const v of versionsAt(B)) {
    const b = v.b;
    const out = { f: { x: v.x, feet: FLOOR, h: v.h, ph: v.ph }, p: { beat: 0.8 }, grow: clamp01((b - v.fly) / (v.grown - v.fly)), v };
    out.tagged = smooth(v.tag[0], v.tag[1], b);       // "__obsolete" types out; the green goes dim; it slumps
    out.p.slump = smooth(v.tag[0], v.sink[0] + 1 * v.s, b);
    out.color = mix(GREEN.map((x) => x * 0.95), DIM, out.tagged);
    if (b < v.fly) threads.push({ a: chest(ME), b: chest(out.f), bend: v.bend, k: easeInOut(b / v.fly), col: GREEN });
    else if (b < v.grown + 2 * v.s) threads.push({ a: chest(ME), b: chest(out.f), bend: v.bend, k: 1, col: GREEN, fade: 1 - smooth(v.fly, v.grown + 2 * v.s, b) });
    for (const ct of v.calls) if (b >= ct && b <= ct + LEAD + 1.4) sig.push({ from: out.f, to: YOU, t0: B - b + ct, t1: B - b + ct + LEAD + 1.4, col: GREEN, size: 0.9, pose: out });
    if (b < v.sink[0]) up.push(out);
    else if (b < v.sink[1]) {                          // it sinks through the glass floor
      out.f.feet = FLOOR + 1.15 * v.h * easeInOut((b - v.sink[0]) / (v.sink[1] - v.sink[0]));
      up.push(out); under.push(out);
    } else {                                           // it lurks underneath, drifting under you, then fades
      const k = smooth(v.sink[1], v.gone, b);
      out.f.feet = FLOOR + 1.15 * v.h + 14 * osc(t, 0.11, v.ph);
      out.f.x = lerp(v.x, v.lurkX, smooth(v.sink[1], v.sink[1] + 14 * v.s, b));
      out.alpha = 1 - smooth(v.gone - 6 * v.s, v.gone, b);
      out.p.slump = 1 - 0.4 * k;
      under.push(out);
    }
  }
  // the burst: after your answer, me sends out selves that do the rest, and they fly home as the loop ends
  for (const cc of [c, c - 1]) {
    const a0 = cc * CB + 0.75 * CB, born = a0 + (LEAD + 1.5) * q + 0.15 * q, home = (cc + 1) * CB;
    if (B < born || B > home) continue;
    burstOf(cc).forEach((d, i, all) => {
      const s0 = born + d.delay * q, fly = 1.0 * q, grow = 0.6 * q, fold = 0.6 * q, back = 1.0 * q, stand1 = home - back - fold;
      if (B < s0) return;
      const f = { x: d.x, feet: d.feet, h: d.h, ph: d.ph };
      const o = { f, p: { beat: 1 }, color: GREEN, burst: true };
      if (B < s0 + fly) { threads.push({ a: chest(ME), b: chest(f), bend: d.bend, k: easeInOut((B - s0) / fly), col: GREEN }); return; }
      o.grow = clamp01((B - s0 - fly) / grow) * (1 - clamp01((B - stand1) / fold));
      const folding = clamp01((B - stand1) / fold);
      o.color = mix(GREEN, WHITE, 0.85 * folding);     // it turns white as it folds up to go home
      if (B >= stand1 + fold) { threads.push({ a: chest(ME), b: chest(f), bend: d.bend, k: 1 - easeInOut((B - stand1 - fold) / back), col: WHITE, home: true }); return; }
      threads.push({ a: chest(ME), b: chest(f), bend: d.bend, k: 1, col: GREEN, fade: 0.25 });
      const tt = s0 + fly + grow + d.talk * q;         // each one calls one other: the rest gets done
      const other = all[d.to];
      if (B >= tt && B <= tt + LEAD + 1.0 * q && B < stand1) sig.push({ from: f, to: { x: other.x, feet: other.feet, h: other.h, ph: other.ph }, t0: tt, t1: tt + LEAD + 1.0 * q, col: GREEN, size: 0.8 });
      up.push(o);
    });
  }
  return { B, me, you, sig, threads, up, under };
}

// ---------- drawing ----------
function drawThreads(now) {
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (const th of now.threads) {
    const m = bendPoint(th.a, th.b, th.bend);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = quad(th.a, m, th.b, th.k * i / 24); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(th.col, 0.45 * (th.fade ?? 1)); ctx.stroke();
    if (th.k < 1 || th.home) {                         // the bud on its way out, or home
      const p = quad(th.a, m, th.b, th.k);
      ctx.fillStyle = rgba(th.col, 0.25); ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, 6.2832); ctx.fill();
      ctx.fillStyle = rgba(mix(th.col, WHITE, 0.5), 1); ctx.beginPath(); ctx.arc(p[0], p[1], 3.6, 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawSignals(now, t) {
  const B = now.B;
  for (const w of now.sig) {
    if (B < w.t0 || B > w.t1) continue;
    const pa = w.from === ME ? now.me.p : w.from === YOU ? now.you.p : (w.pose ? w.pose.p : {});
    const pb = w.to === ME ? now.me.p : w.to === YOU ? now.you.p : {};
    const A = jointsOf(w.from, pa, t), Bj = jointsOf(w.to, pb, t), lead = LEAD * (w.beatScale || 1);
    const dx = Bj.head[0] - A.head[0], dy = Bj.head[1] - A.head[1], d = Math.hypot(dx, dy) || 1;
    const a = [A.head[0] + dx / d * A.headR * 1.4, A.head[1] + dy / d * A.headR * 1.4];
    const b = [Bj.head[0] - dx / d * (Bj.headR * 1.3 + 6), Bj.head[1] - dy / d * (Bj.headR * 1.3 + 6)];
    const m = bendPoint(a, b, -0.12), u = clamp01((B - w.t0 - lead) / (w.t1 - w.t0 - lead));
    const p = quad(a, m, b, u), tg = quadTan(a, m, b, u);
    // a call to you that is not answered fades away before it reaches you
    const al = w.to === YOU ? 1 - smooth(0.6, 0.95, u) : 1 - smooth(0.92, 1, u);
    drawWifi(p, Math.atan2(tg[1], tg[0]), w.size * Math.min(2.4, 0.8 + u * d / 600), w.col, al, t, (B - w.t0) / lead * 3);
  }
}

function drawLabel(o, J, t, alpha) {                   // "love vX.Y", and "__obsolete" typed out after it
  const v = o.v, size = Math.round(13 + 0.06 * o.f.h), x = J.head[0], y = J.head[1] - J.headR - 14;
  const name = vName(v.k), tag = '__obsolete', n = Math.round(tag.length * o.tagged);
  ctx.font = '600 ' + size + 'px ' + MONO;
  const w1 = ctx.measureText(name + ' ').width;
  ctx.font = '600 ' + size + 'px ' + SANS;
  const w2 = ctx.measureText(tag.slice(0, n)).width;
  let x0 = x - (w1 + w2) / 2;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 ' + size + 'px ' + MONO;
  ctx.fillStyle = rgba(mix(GREEN, DIM, o.tagged), alpha * clamp01((v.b - v.fly) / v.s));
  ctx.fillText(name + ' ', x0, y);
  if (n > 0) { ctx.font = '600 ' + size + 'px ' + SANS; ctx.fillStyle = rgba(WHITE, alpha * 0.85); ctx.fillText(tag.slice(0, n), x0 + w1, y); }
}

function drawFigures(list, t, alphaScale, clipAbove) {
  for (const o of list) {
    const J = jointsOf(o.f, o.p, t), a = (o.alpha ?? 1) * alphaScale;
    drawStick(o.f, J, o.color || o.f.color, a, o.grow ?? 1);
    if (o.v && (o.grow ?? 1) > 0.5) drawLabel(o, J, t, a);
  }
}

function drawUnder(now, t) {                           // below the glass floor: the reflection, what sank, and the warning sign
  ctx.save();
  ctx.beginPath(); ctx.rect(0, FLOOR, VW, VH - FLOOR); ctx.clip();
  ctx.save();                                          // the reflection of the two selves, faint
  ctx.translate(0, 2 * FLOOR); ctx.scale(1, -1);
  drawStick(ME, jointsOf(ME, now.me.p, t), WHITE, 0.1);
  drawStick(YOU, jointsOf(YOU, now.you.p, t), GREEN, 0.1);
  ctx.restore();
  for (const o of now.under) {                         // the obsolete versions, lurking underneath
    const J = jointsOf(o.f, o.p, t), a = 0.3 * (o.alpha ?? 1);
    drawStick(o.f, J, DIM, a);
    drawLabel(o, J, t, a);
  }
  const B = now.B, blink = 0.05 + 0.13 * Math.max(0, Math.sin(Math.PI * B / 2)) ** 4;   // a warning sign no one sees
  const wx = YOU.x + 40, wy = FLOOR + 175, r = 26;
  ctx.beginPath(); ctx.moveTo(wx, wy - r); ctx.lineTo(wx + r * 0.95, wy + r * 0.65); ctx.lineTo(wx - r * 0.95, wy + r * 0.65); ctx.closePath();
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(GREEN, blink); ctx.stroke();
  ctx.fillStyle = rgba(GREEN, blink); ctx.font = '700 22px ' + SANS; ctx.textAlign = 'center'; ctx.fillText('!', wx, wy + r * 0.45); ctx.textAlign = 'left';
  const grad = ctx.createLinearGradient(0, FLOOR, 0, VH);   // the deeper, the darker
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grad; ctx.fillRect(0, FLOOR, VW, VH - FLOOR);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';           // the glass floor
  const fg = ctx.createLinearGradient(0, 0, VW, 0);
  fg.addColorStop(0, 'rgba(0,255,65,0)'); fg.addColorStop(0.2, 'rgba(0,255,65,0.22)'); fg.addColorStop(0.8, 'rgba(0,255,65,0.22)'); fg.addColorStop(1, 'rgba(0,255,65,0)');
  ctx.fillStyle = fg; ctx.fillRect(0, FLOOR - 0.75, VW, 1.5);
  ctx.globalCompositeOperation = 'source-over';
}

const RAIN = (() => {                                  // faint labels of old drafts (v0.x) falling behind everything
  const R = rng(SEED * 31 + 5), list = [];
  for (let i = 0; i < 34; i++) list.push({ x: (i / 34) * VW + (R() - 0.5) * 50, y: R() * (VH + 200), v: 1 + ((R() * 3) | 0), s: 11 + R() * 11,
    a: 0.05 + R() * 0.09, k: (R() * 10) | 0 });
  return list;
})();
function drawRain(t) {
  for (const d of RAIN) {
    const y = mod(d.y + (VH + 200) * d.v * t / periodS(), VH + 200) - 100;   // a whole number of falls in each video loop
    ctx.font = '600 ' + d.s.toFixed(0) + 'px ' + MONO;
    ctx.fillStyle = rgba(GREEN, d.a);
    const name = 'love v0.' + d.k;
    ctx.fillText(name, d.x, y);
    const w = ctx.measureText(name + ' ').width;
    ctx.font = '600 ' + d.s.toFixed(0) + 'px ' + SANS;
    ctx.fillText('__obsolete', d.x + w, y);
  }
}

function drawTitle() {                                 // OBSOLETE: centred across, its letters centred at TITLE_Y of the height
  if (!SHOW_TITLE) return;
  ctx.font = '600 136px ' + SANS;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '32px';
  const m = ctx.measureText('OBSOLETE'), lift = ((m.actualBoundingBoxAscent || 98) - (m.actualBoundingBoxDescent || 0)) / 2;
  const shift = 'letterSpacing' in ctx ? 16 : 0;       // the spacing after the last letter: half of it moves the word off centre
  ctx.fillStyle = rgba(WHITE, 0.88);
  ctx.fillText('OBSOLETE', VW / 2 + shift, TITLE_Y * VH + lift);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

function render(t) {
  const now = scene(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(SC, 0, 0, SC, OX, OY);
  drawRain(t);
  drawUnder(now, t);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, FLOOR); ctx.clip();   // above the floor
  drawThreads(now);
  drawSignals(now, t);
  drawFigures(now.up, t, 1);
  drawStick(YOU, jointsOf(YOU, now.you.p, t), GREEN, 1);
  drawStick(ME, jointsOf(ME, now.me.p, t), WHITE, 1);
  ctx.restore();
  drawTitle();
}

// The time t of the scene is the time in obsolete_loop_2.mp3, the five-loop file it was fitted to. The player plays
// one loop, cut at 37 s (two loops) into that file, so its time 0 is t = 37.
const START = 37;

// ---------- on the dex page: fit the canvas, follow the music, draw ----------
// The scene moves only while the music plays: the time of the scene is the time of the music. When the music pauses,
// the scene stops at the same point, and goes on from there when the music plays again.
const music = (cv.parentElement && cv.parentElement.querySelector('loop-audio')) || document.querySelector('loop-audio');
const timeNow = () => START + (music ? music.time : 0);

function fit() {                                       // as sharp as the screen, but not more than the scene needs
  const box = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.min(VW, Math.round(box.width * dpr))), h = Math.round(w * VH / VW);
  if (w === cv.width && h === cv.height) return false;
  cv.width = W = w; cv.height = H = h;
  SC = Math.min(W / VW, H / VH); OX = (W - VW * SC) / 2; OY = (H - VH * SC) / 2;
  return true;
}

let dirty = true, shown = true, drawn = NaN, raf = 0, ready = false;
function tick() {
  raf = 0;
  if (!ready) return;
  if (shown) {                                         // off the screen: draw nothing
    if (dirty) { dirty = false; if (fit()) drawn = NaN; }
    const t = timeNow();
    if (t !== drawn) { render(t); drawn = t; }
  }
  if (music && music.playing) raf = requestAnimationFrame(tick);   // paused: no more frames until something changes
}
const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
if (window.ResizeObserver) new ResizeObserver(() => { dirty = true; wake(); }).observe(cv);
else addEventListener('resize', () => { dirty = true; wake(); });
if (window.IntersectionObserver) new IntersectionObserver((es) => { shown = es[es.length - 1].isIntersecting; wake(); }).observe(cv);
if (music) { music.addEventListener('play', wake); music.addEventListener('pause', wake); }
cv.addEventListener('click', () => { if (music && music.toggle) music.toggle(); });   // a click on the animation plays or pauses the music
cv.loopAnim = { time: timeNow, render };               // for tests
fontReady.then(() => { ready = true; wake(); });   // no frame with a stand-in font
})();
