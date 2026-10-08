/*
  Dil Chahta Hai: the animation for the Dil Chahta Hai recut loop. Three friends walk a path hand in hand
  into the wind and talk all day; in the evening they dance; at night they sit and sing, and each line they sing
  becomes a star; at dawn the stars fall onto their path, so the path that they walk sparkles.

  On a dex page: a <canvas class="loop-anim">, and a <loop-audio> player in the same parent (else the first on the page).
    <span class="loop-stage"><canvas class="loop-anim" width="1920" height="1080"></canvas><loop-audio ...>Name</loop-audio></span>
    <script src="assets/dch-anim.js" defer></script>
  The canvas can have any size and shape (the page CSS sets it): the scene fills it.
  The animation moves only while the music plays, and follows it to the beat. When the music pauses, it stops.
  A click on the animation plays or pauses the music. Made from dil-chahta-hai.html: the same scene, without the
  panel, the keys and the export.
  Josefin Sans (SIL Open Font License 1.1) comes from josefin-sans.woff2 next to this script.
*/
(() => {
'use strict';
const cv = document.querySelector('canvas.loop-anim');
if (!cv || !cv.getContext) return;
const HERE = document.currentScript ? document.currentScript.src : location.href;
// ---------- settings ----------
const BPM = 103.784;                                   // measured from dch_loop1.mp3
const OFFSET = 0.605;                                  // the start of a loop (bar 1 of the chorus), in seconds
const BARS = 8;                                        // bars in one loop
const LOOPS = 10;                                                  // loops in one video loop: 10 are the 185 s of the file
// measured from dch_loop1.mp3 on each half beat of one 8-bar loop, 0..1: the kick and bass, the voice range, and the air
const GROOVE = [0.01, 0.0, 1.0, 0.61, 0.53, 0.31, 0.03, 0.7, 0.27, 0.67, 0.92, 0.47, 0.44, 0.3, 0.08, 0.76, 0.25, 0.05, 0.58, 0.45, 0.49, 0.23, 0.03, 0.75, 0.23, 0.81, 0.83, 0.58, 0.52, 0.24, 0.07, 0.67, 0.33, 0.04, 0.97, 0.38, 0.48, 0.22, 0.02, 0.62, 0.21, 0.58, 0.66, 0.49, 0.48, 0.24, 0.08, 0.77, 0.25, 0.05, 0.7, 0.31, 0.4, 0.24, 0.03, 0.62, 0.22, 0.61, 0.66, 0.62, 0.49, 0.23, 0.07, 0.32];
const VOICE = [0.53, 0.76, 0.85, 0.89, 0.69, 0.97, 0.75, 0.52, 0.4, 0.57, 0.39, 0.55, 0.26, 0.23, 0.26, 0.29, 0.66, 0.65, 0.95, 0.54, 0.63, 0.98, 0.53, 0.36, 0.44, 0.52, 0.23, 0.05, 0.0, 0.2, 0.25, 0.4, 0.61, 0.61, 0.93, 0.79, 0.6, 0.77, 0.65, 0.32, 0.28, 0.45, 0.43, 0.7, 0.35, 0.26, 0.14, 0.26, 0.85, 0.76, 0.82, 0.71, 0.63, 1.0, 0.54, 0.41, 0.43, 0.38, 0.19, 0.25, 0.23, 0.43, 0.13, 0.37];
const AIR = [0.24, 0.2, 0.76, 0.4, 0.95, 0.86, 0.21, 0.39, 0.95, 0.13, 0.11, 0.15, 0.5, 0.8, 0.32, 0.66, 1.0, 0.31, 0.4, 0.42, 0.95, 0.74, 0.21, 0.24, 0.86, 0.0, 0.13, 0.19, 0.43, 0.76, 0.33, 0.67, 0.9, 0.28, 0.39, 0.56, 0.78, 0.79, 0.26, 0.35, 0.91, 0.09, 0.06, 0.41, 0.54, 0.74, 0.4, 0.66, 0.71, 0.32, 0.42, 0.66, 0.75, 0.68, 0.24, 0.36, 0.8, 0.08, 0.1, 0.39, 0.52, 0.61, 0.02, 0.22];
let W = 1920, H = 1080;                                // the canvas size: fit() sets it
const SEED = 7;
const SHOW_TITLE = true;
const TITLE_Y = 0.17, TITLE_MAX = 0.6;                 // the middle of the title's letters, as a part of the height from the top;
                                                       // the title is at most TITLE_MAX of the screen width
const VW = 1920, VH = 1080, FLOOR = 790;              // the scene is drawn in this space; the ground is at y = FLOOR
const WHITE = [255, 255, 255], GREEN = [0, 255, 65], PALE = [150, 255, 175], DIM = [70, 150, 90];
const MONO = "'Josefin Sans', sans-serif", SANS = MONO;   // all text is Josefin Sans
const fontReady = (() => {                             // Josefin Sans, from the file next to this script
  try {
    const face = new FontFace('Josefin Sans', 'url(' + new URL('josefin-sans.woff2', HERE).href + ')', { weight: '100 700' });
    document.fonts.add(face);
    return Promise.race([face.load(), new Promise((ok) => setTimeout(ok, 4000))]).catch(() => {});
  } catch (e) { return Promise.resolve(); }
})();
const LEAD = 0.35;                                     // beats the wifi arcs take to light up before a signal flies
const SPEED = 70;                                      // scene pixels the friends walk in one beat: one step on each beat
const FRIENDS = [                                      // x by day, x at night (closer together), height, colour, scarf colour
  { x: 818, gx: 838, h: 224, color: GREEN, scarf: WHITE, ph: 0.4 },
  { x: 960, gx: 960, h: 240, color: WHITE, scarf: GREEN, ph: 2.2 },
  { x: 1102, gx: 1082, h: 216, color: PALE, scarf: WHITE, ph: 4.1 },
];

// ---------- small helpers ----------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const win = (t, a, b, d) => smooth(a, a + d, t) * (1 - smooth(b - d, b, t));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const mod = (a, n) => ((a % n) + n) % n;
const easeIn = (x) => x * x;
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

// ---------- the beat, the wind and the day ----------
const CB = BARS * 4;                                   // beats in one loop
const DAY = 2 * CB;                                    // beats in one day: two loops
const DAYS = LOOPS / 2;                                // days in one video loop
const beatOf = (t) => (t - OFFSET) * BPM / 60;        // beats since the first downbeat
const pulse = (B) => {                                 // the groove: high on each hit of the kick and bass, then falling fast
  const h = B * 2, i = Math.floor(h), fr = h - i;
  return GROOVE[mod(i, 64)] * Math.exp(-fr * 3) + 0.5 * GROOVE[mod(i - 1, 64)] * Math.exp(-(fr + 1) * 3);
};
const voiceAt = (h) => VOICE[mod(h, 64)];             // the voice on half beat h
const GUST = (() => {                                  // the air of the music, held a little: it rises fast and falls slowly
  const g = AIR.map((_, i) => { let s = 0, n = 0; for (let k = 0; k < 8; k++) { const w = Math.exp(-0.6 * k); s += AIR[mod(i - k, 64)] * w; n += w; } return s / n; });
  const lo = Math.min(...g), hi = Math.max(...g);
  return g.map((x) => (x - lo) / (hi - lo));
})();
const windAt = (B) => { const h = B * 2, i = Math.floor(h), x = h - i; return lerp(GUST[mod(i, 64)], GUST[mod(i + 1, 64)], x * x * (3 - 2 * x)); };
const periodS = () => CB * LOOPS * 60 / BPM;          // seconds until the whole scene repeats
const osc = (t, f, ph) => { const P = periodS(); return Math.sin(2 * Math.PI * Math.max(1, Math.round(f * P)) / P * t + ph); }; // f in Hz, made to fit

// One day, in beats b from its start (bar 1 of the first loop):
//   0..4    dawn: the sun comes up, last night's stars fall onto the path, the friends stand up and take hands
//   4..32   they walk and talk, hand in hand, into the wind
//   32..40  evening: the sun goes down; they let go and dance
//   40..64  night: they sit together and sing; each line they sing becomes a star
const dayOf = (B) => Math.floor(B / DAY);
const inDay = (B) => mod(B, DAY);
const walkEnv = (b) => smooth(4, 7, b) * (1 - smooth(29, 32, b));
const sitEnv = (b) => (b >= 36 ? smooth(40, 42.5, b) : 1 - smooth(0, 2.5, b));
const holdEnv = (b) => smooth(1.5, 3.5, b) * (1 - smooth(31, 32.5, b));
const danceEnv = (b) => win(b, 32, 40.5, 1.5);
const lightOf = (b) => (b < 32 ? smooth(0, 6, b) : 1 - smooth(33, 43, b));   // 1 by day, 0 at night
const STEPS = 16;                                      // the walked distance, a table in 1/16 beats
const CUM = (() => { const c = new Float64Array(DAY * STEPS + 1); for (let i = 1; i <= DAY * STEPS; i++) c[i] = c[i - 1] + walkEnv((i - 0.5) / STEPS) / STEPS; return c; })();
const DPD = CUM[DAY * STEPS] * SPEED;                  // scene pixels walked in one day
const PATH = DAYS * DPD;                               // ... and in one video loop: the scenery repeats after this
function walkedAt(B) {                                 // scene pixels walked since the first day
  const d = Math.floor(B / DAY), x = (B - d * DAY) * STEPS, i = Math.min(DAY * STEPS - 1, Math.floor(x));
  return d * DPD + (CUM[i] + (CUM[i + 1] - CUM[i]) * (x - i)) * SPEED;
}

// ---------- one stick figure ----------
function ik(s, t, l1, l2, pref) {                      // two-bone limb; the middle joint bends toward pref
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [s[0] + l1 * Math.cos(th + a), s[1] + l1 * Math.sin(th + a)], e2 = [s[0] + l1 * Math.cos(th - a), s[1] + l1 * Math.sin(th - a)];
  const end = [s[0] + d * Math.cos(th), s[1] + d * Math.sin(th)], m = [(s[0] + end[0]) / 2, (s[1] + end[1]) / 2];
  const k1 = (e1[0] - m[0]) * pref[0] + (e1[1] - m[1]) * pref[1], k2 = (e2[0] - m[0]) * pref[0] + (e2[1] - m[1]) * pref[1];
  return [k1 >= k2 ? e1 : e2, end];
}
// f: x, feet, h, ph. p: walk (0..1) and st (the step phase), sit, wu (arms up), lean (radians, + is forward), dip
// (knees bend), sing (the head tips back and the front arm opens), holdA and holdB (where the back and the front hand
// hold a friend's hand, in scene pixels) with hold (how much)
function jointsOf(f, p, t) {
  const s = f.h, walk = p.walk || 0, sit = p.sit || 0, wu = p.wu || 0, st = p.st || 0, sing = p.sing || 0, ph = f.ph || 0;
  const breath = osc(t, 0.3, ph) * 0.006, sn = Math.sin(st), cs = Math.cos(st);
  const dip = walk * 0.016 * Math.abs(sn) + (p.dip || 0);
  const hip = [lerp(0, -0.06, sit), lerp(-0.37 + dip, -0.12, sit)];
  const lean = (p.lean || 0) + walk * 0.05 - sit * 0.12, up = [Math.sin(lean), -Math.cos(lean)];
  const at = (k) => [hip[0] + up[0] * k, hip[1] + up[1] * k + (k > 0.3 ? breath : 0)];
  const sh = at(0.35), neck = at(0.4), chest = at(0.18), tilt = lean - sing * 0.3;
  const head = [neck[0] + Math.sin(tilt) * 0.105, neck[1] - Math.cos(tilt) * 0.105];
  // the feet: apart when standing; one step on each beat when walking; forward, knees up, when sitting
  const a = SPEED / (2 * s) * walk, lift = 0.055 * walk;
  let fA = [lerp(-0.12, a * sn, walk), -lift * Math.max(0, cs)], fB = [lerp(0.12, -a * sn, walk), -lift * Math.max(0, -cs)];
  fA = lerp2(fA, [0.2, 0], sit); fB = lerp2(fB, [0.13, 0], sit);
  const kw = Math.max(walk, sit);
  const [kA, footA] = ik(hip, fA, 0.2, 0.2, [lerp(-1, 1, kw), -sit]), [kB, footB] = ik(hip, fB, 0.2, 0.2, [lerp(1, 1, kw), -sit]);
  // the hands, relative to the shoulder: at rest; swinging against the legs when walking; up; on the knees; holding
  const rel = (v) => [sh[0] + v[0], sh[1] + v[1]];
  const swing = osc(t, 0.25, ph) * 0.02;
  let hA = lerp2(rel([-0.2 - swing, 0.34]), rel([-0.05 - 0.13 * sn, 0.35]), walk);
  let hB = lerp2(rel([0.2 + swing, 0.34]), rel([0.05 + 0.13 * sn, 0.35]), walk);
  hA = lerp2(hA, rel([-0.34 + 0.04 * Math.sin(st), -0.34]), wu); hB = lerp2(hB, rel([0.34 - 0.04 * Math.sin(st), -0.34]), wu);
  hA = lerp2(hA, [kA[0] + 0.03, kA[1] - 0.01], sit); hB = lerp2(hB, [kB[0] + 0.03, kB[1] - 0.01], sit);
  const local = (q) => [(q[0] - f.x) / s, (q[1] - f.feet) / s];
  if (p.holdA) hA = lerp2(hA, local(p.holdA), p.hold);
  if (p.holdB) hB = lerp2(hB, local(p.holdB), p.hold);
  hB = lerp2(hB, rel([0.27, -0.13]), sing);
  const [eA, handA] = ik(sh, hA, 0.2, 0.21, [-1, 0.4]), [eB, handB] = ik(sh, hB, 0.2, 0.21, [1, 0.4]);
  const P = (u) => [f.x + u[0] * s, f.feet + u[1] * s];
  return { head: P(head), headR: 0.105 * s, neck: P(neck), sh: P(sh), hip: P(hip), chest: P(chest),
    elbowA: P(eA), handA: P(handA), elbowB: P(eB), handB: P(handB), kneeA: P(kA), footA: P(footA), kneeB: P(kB), footB: P(footB) };
}

const ctx = cv.getContext('2d', { alpha: false });
let SC = 1, OX = 0, OY = 0;                            // from the scene to the canvas: place() sets them
let X0 = 0, X1 = VW, Y0 = 0, Y1 = VH;                  // the part of the scene that is on the screen

function line(pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
function glow(color, alpha, lw) {                      // stroke the current path with a soft glow, as in the other animations
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.16 * alpha); ctx.lineWidth = lw * 2.8; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = lw; ctx.stroke();
}
function drawStick(f, J, color, alpha) {
  const lw = Math.max(1.4, f.h * 0.032);
  ctx.beginPath(); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832); ctx.fillStyle = '#000'; ctx.fill();
  ctx.beginPath();
  line([J.neck, J.chest, J.hip]);
  line([J.handA, J.elbowA, J.sh, J.elbowB, J.handB]);
  line([J.footA, J.kneeA, J.hip, J.kneeB, J.footB]);
  ctx.moveTo(J.head[0] + J.headR, J.head[1]); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832);
  glow(color, alpha, lw);
}
function drawScarf(f, J, color, wind, walk, t) {      // a scarf: a ribbon from the neck, flying back in the wind
  const L = f.h * 0.062, k = clamp01(0.2 + 0.55 * wind + 0.35 * walk), w0 = f.h * 0.034;
  let x = J.neck[0] - f.h * 0.01, y = J.neck[1] + f.h * 0.025;
  const mid = [[x, y]];
  for (let j = 1; j <= 7; j++) {
    const ang = Math.PI - (1 - k) * 1.3 + (0.15 + 0.35 * k) * (j / 7) * osc(t, 1.3, f.ph - j * 0.9);
    x += Math.cos(ang) * L; y += Math.sin(ang) * L;
    mid.push([x, y]);
  }
  const side = (sgn) => mid.map((q, j) => {            // the two edges of the ribbon, narrower toward its end
    const a = mid[Math.max(0, j - 1)], c = mid[Math.min(mid.length - 1, j + 1)], dx = c[0] - a[0], dy = c[1] - a[1], n = Math.hypot(dx, dy) || 1;
    const w = w0 * (1 - 0.75 * j / (mid.length - 1)) / 2 * sgn;
    return [q[0] - dy / n * w, q[1] + dx / n * w];
  });
  const top = side(1), bot = side(-1).reverse();
  ctx.beginPath(); line(top.concat(bot)); ctx.closePath();
  ctx.fillStyle = rgba(color, 0.22); ctx.fill();
  glow(color, 0.85, Math.max(1, f.h * 0.008));
  ctx.beginPath(); ctx.moveTo(J.neck[0] - f.h * 0.05, J.neck[1] + f.h * 0.02); ctx.lineTo(J.neck[0] + f.h * 0.05, J.neck[1] + f.h * 0.02);
  glow(color, 0.9, Math.max(1.4, f.h * 0.02));        // the scarf round the neck
}
function drawWifi(p, dir, s, col, alpha, B, reveal) {   // a wifi symbol: a dot, and three arcs that open toward dir
  if (alpha <= 0.003) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(p[0], p[1], 2 + 0.5 * s, 0, 6.2832); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const v = clamp01(reveal - k);
    if (v <= 0) continue;
    const beat = 0.6 + 0.4 * Math.max(0, Math.sin(2 * Math.PI * (B - k / 3)));   // the arcs pulse on the beat
    ctx.beginPath(); ctx.arc(p[0], p[1], (6 + 6 * k) * s, dir - 0.78, dir + 0.78);
    ctx.strokeStyle = rgba(col, alpha * v * 0.16); ctx.lineWidth = 3 + 2.5 * s; ctx.stroke();
    ctx.strokeStyle = rgba(col, alpha * v * beat * 0.9); ctx.lineWidth = 1.2 + 0.7 * s; ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawStar(x, y, r, alpha) {                    // a star: a bright point with a soft halo and a small cross
  if (alpha <= 0.003) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(WHITE, 0.14 * alpha); ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(WHITE, alpha); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = rgba(WHITE, 0.5 * alpha); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - r * 5, y); ctx.lineTo(x + r * 5, y); ctx.moveTo(x, y - r * 5); ctx.lineTo(x, y + r * 5); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- the scenery: made once, it repeats once in each video loop ----------
const SKY = (() => { const R = rng(SEED * 13 + 1), l = []; for (let i = 0; i < 160; i++) l.push({ fx: R(), fy: R(), a: 0.15 + 0.45 * R(), r: 0.6 + 1.1 * R(), ph: R() * 6.28 }); return l; })();
const HILLS = [0.3, 0.6].map((f, n) => {               // two ridges of hills: far and slow, near and faster
  const R = rng(SEED * 17 + n), L = f * PATH;
  return { f, L, base: n ? FLOOR - 22 : FLOOR - 70, amp: n ? 30 : 75, alpha: n ? 0.32 : 0.5,
    waves: [1300, 820, 470, 300].map((wl, j) => ({ k: Math.max(1, Math.round(L / wl)), a: [0.5, 0.3, 0.14, 0.06][j], ph: R() * 6.28 })) };
});
const TREES = (() => { const R = rng(SEED * 19 + 2), l = [], N = 9; for (let i = 0; i < N; i++) l.push({ wx: (i + 0.5 + 0.6 * (R() - 0.5)) / N, h: 250 + 170 * R(), lean: (R() - 0.5) * 0.12, spread: [0.38 + 0.12 * R(), 0.4 + 0.12 * R(), 0.42 + 0.12 * R(), 0.45 + 0.1 * R()], ph: R() * 6.28 }); return l; })();
const GRASS = (() => { const R = rng(SEED * 23 + 3), l = []; for (let i = 0; i < 170; i++) l.push({ wx: R(), h: 9 + 14 * R(), n: 2 + ((R() * 3) | 0), ph: R() * 6.28 }); return l; })();
const SPARK = (() => { const R = rng(SEED * 29 + 4), l = []; for (let i = 0; i < 1500; i++) l.push({ wx: R(), yf: R(), ph: R() * 6.28, k: R() }); return l; })();
const WINDS = (() => { const R = rng(SEED * 31 + 5), l = []; for (let i = 0; i < 22; i++) l.push({ yf: Math.pow(R(), 0.7), n: 0, sec: 3 + 4 * R(), ph: R(), len: 260 + 360 * R(), amp: 6 + 16 * R(), wl: 220 + 260 * R(), ph2: R() * 6.28 }); return l; })();
const LEAVES = (() => { const R = rng(SEED * 37 + 6), l = []; for (let i = 0; i < 16; i++) l.push({ yf: R(), sec: 5 + 5 * R(), ph: R(), size: 7 + 7 * R(), spin: 0.6 + 1.6 * R(), bob: 20 + 50 * R(), ph2: R() * 6.28, green: R() < 0.7 }); return l; })();
const crossings = (sec) => Math.max(1, Math.round(periodS() / sec));   // a whole number of crossings in each video loop
const depthOf = (yf) => 1 + 1.1 * yf;                  // the path: nearer (lower) sparkles go past faster
const tiled = (wx, L, off, margin) => X0 - margin + mod(wx - off - (X0 - margin), L);   // where a thing at wx is on the screen

// ---------- what is happening at time t ----------
const songCache = new Map();
function songsOf(d) {                                  // the lines sung in the night of day d: who sings, when, and its star
  const dm = mod(d, DAYS);
  let list = songCache.get(dm);
  if (list) return list;
  list = [];
  let n = 0;
  for (let h = 2 * 41; h < 2 * 61.5; h++) {            // the half beats of the night where the voice is strong
    if (voiceAt(h) < 0.6) continue;
    const R = rngOf(dm, h, 7);
    list.push({ b: h / 2, singer: (n + dm) % 3, fx: 0.1 + 0.8 * R(), fy: R(), ph: R() * 6.28, fall: R(), drift: R(), depth: R() });
    n++;
  }
  songCache.set(dm, list);
  return list;
}
const SONG_FLY = LEAD + 1.8;                           // beats a song takes to rise and become a star
const starAt = (e) => [lerp(X0, X1, e.fx), lerp(Y0 + 90, FLOOR - 330, e.fy)];

function scene(t) {
  const B = beatOf(t), b = inDay(B), d = dayOf(B), X = walkedAt(B);
  const walk = walkEnv(b), sit = sitEnv(b), hold = holdEnv(b), dance = danceEnv(b), light = lightOf(b), wind = windAt(B);
  const songs = songsOf(d);
  const friends = FRIENDS.map((F, i) => {
    const f = { x: lerp(F.x, F.gx, sit), feet: FLOOR, h: F.h, ph: F.ph };
    let sing = 0;
    if (b >= 40) for (const e of songs) if (e.singer === i) sing = Math.max(sing, win(b, e.b - 0.5, e.b + 1.6, 0.4));
    const p = { walk, sit, st: Math.PI * X / SPEED + i * 0.5, sing,
      wu: dance * (0.75 + 0.25 * Math.sin(Math.PI * B + i)),
      lean: dance * 0.11 * Math.sin(Math.PI * B + i * 0.6) + sit * 0.035 * osc(t, 0.12, F.ph),
      dip: dance * (0.035 * pulse(B) - 0.01) };
    return { F, f, p, J: jointsOf(f, p, t) };
  });
  if (hold > 0) {                                      // hand in hand: each one holds the next one's hand
    for (let i = 0; i < 2; i++) {
      const a = friends[i], c = friends[i + 1], hh = (a.f.h + c.f.h) / 2;
      const pt = [(a.J.sh[0] + c.J.sh[0]) / 2 + 0.02 * hh * Math.sin(a.p.st), (a.J.sh[1] + c.J.sh[1]) / 2 + 0.27 * hh];
      a.p.holdB = pt; c.p.holdA = pt;
    }
    for (const o of friends) { o.p.hold = hold; o.J = jointsOf(o.f, o.p, t); }
  }
  // talking in the day: on the beats where the voice is strong, one friend calls another
  const talks = [];
  for (let e = Math.floor(B); e > B - 2.5; e--) {
    const be = inDay(e);
    if (be < 6 || be > 29 || Math.max(voiceAt(2 * e), voiceAt(2 * e + 1)) < 0.62) continue;
    const R = rngOf(mod(dayOf(e), DAYS), mod(e, DAY), 9), a = (R() * 3) | 0, c = (a + 1 + ((R() * 2) | 0)) % 3;
    talks.push({ from: a, to: c, t0: e, t1: e + LEAD + 1.3 });
  }
  return { B, b, d, X, walk, sit, light, night: 1 - light, wind, friends, talks, songs, last: songsOf(d - 1) };
}

// ---------- drawing ----------
function drawSky(now, t) {                             // stars and the moon at night; the sun by day
  const { b, night, light } = now;
  for (const s of SKY) {
    const a = night * s.a * (0.6 + 0.4 * osc(t, 0.21, s.ph));
    if (a < 0.01) continue;
    ctx.fillStyle = rgba(WHITE, a * 0.8); ctx.beginPath(); ctx.arc(lerp(X0, X1, s.fx), lerp(Y0, FLOOR - 120, s.fy), s.r * 0.8, 0, 6.2832); ctx.fill();
  }
  const moon = night * (b >= 36 ? smooth(40, 45, b) : 1 - smooth(1, 5, b));
  if (moon > 0.01) {                                   // a crescent: a white disc, and a black one over most of it
    const nb = mod(b - 40, DAY), mx = lerp(X0, X1, 0.84) - nb * 2.5, my = lerp(Y0, FLOOR, 0.42) - nb * 1.2;
    const halo = ctx.createRadialGradient(mx, my, 30, mx, my, 130);
    halo.addColorStop(0, rgba(WHITE, 0.1 * moon)); halo.addColorStop(1, rgba(WHITE, 0));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = halo; ctx.fillRect(mx - 130, my - 130, 260, 260); ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, 38, 0, 6.2832); ctx.clip();
    ctx.fillStyle = rgba(WHITE, 0.92 * moon); ctx.fillRect(mx - 40, my - 40, 80, 80);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(mx + 15, my - 9, 34, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  const u = (b + 3) / 45;                              // the sun: up from the left at dawn, down on the right in the evening
  if (u > 0 && u < 1) {
    const sx = lerp(380, 1540, u), sy = FLOOR + 40 - Math.sin(Math.PI * u) * 560, low = 1 - smooth(0, 0.22, Math.min(u, 1 - u));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 30, sx, sy, 260);
    g.addColorStop(0, rgba(WHITE, 0.22)); g.addColorStop(0.4, rgba(GREEN, 0.05 + 0.05 * low)); g.addColorStop(1, rgba(GREEN, 0));
    ctx.fillStyle = g; ctx.fillRect(sx - 260, sy - 260, 520, 520);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(WHITE, 0.95); ctx.beginPath(); ctx.arc(sx, sy, 40, 0, 6.2832); ctx.fill();
    // a green haze low over the land: brighter when the sun is low
    const hz = ctx.createLinearGradient(0, FLOOR - 420, 0, FLOOR);
    hz.addColorStop(0, rgba(GREEN, 0)); hz.addColorStop(1, rgba(GREEN, 0.05 * light + 0.1 * low * Math.min(1, 4 * Math.min(u, 1 - u) + 0.2)));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hz; ctx.fillRect(X0, FLOOR - 420, X1 - X0, 420); ctx.globalCompositeOperation = 'source-over';
  }
}

function drawSongs(now, t) {                           // songs rise and become stars; at dawn the stars fall onto the path
  const { B, b, d, friends } = now;
  if (b >= 40) {                                       // tonight's songs and stars
    for (const e of now.songs) {
      if (b < e.b) continue;
      const arrive = e.b + SONG_FLY, star = starAt(e);
      if (b < arrive + 0.9) {                          // the song, rising as a wifi signal from the singer's head
        const J = friends[e.singer].J, a = [J.head[0], J.head[1] - J.headR * 1.4], m = bendPoint(a, star, 0.12 * (e.fx < 0.5 ? 1 : -1));
        const u = clamp01((b - e.b - LEAD) / (SONG_FLY - LEAD)), p = quad(a, m, star, u), tg = quadTan(a, m, star, u);
        drawWifi(p, Math.atan2(tg[1], tg[0]), 1 + 0.7 * u, friends[e.singer].F.color, 1 - smooth(0.9, 1, u), B, (b - e.b) / LEAD * 3);
      }
      if (b >= arrive) drawStar(star[0], star[1], 3.2, smooth(arrive, arrive + 0.6, b) * (0.75 + 0.25 * osc(t, 0.4, e.ph)));
    }
  }
  if (b < 40) {                                        // last night's stars: in the sky, falling at dawn, then on the path
    const Xd = walkedAt(d * DAY);
    for (const e of now.last) {
      const star = starAt(e), f0 = 0.3 + 2.4 * e.fall, f1 = f0 + 2.4, depth = 0.15 + 0.6 * e.depth;
      const land = [star[0] - 60 - 160 * e.drift, FLOOR + 10 + depth * Math.min(240, Y1 - FLOOR - 20)];
      if (b < f0) drawStar(star[0], star[1], 3.2, 0.75 + 0.25 * osc(t, 0.4, e.ph));
      else if (b < f1) {                               // falling, with a short trail
        const u = easeIn((b - f0) / 2.4), p = lerp2(star, land, u);
        p[0] += Math.sin(u * Math.PI) * 30 * (e.drift - 0.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(WHITE, 0.35); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        const q = lerp2(star, land, Math.max(0, u - 0.08)); ctx.lineTo(q[0], q[1]); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawStar(p[0], p[1], 3, 1);
      } else {                                         // on the path: it goes by as they walk, and glows less as the day goes on
        const x = land[0] - depthOf(depth) * (now.X - Xd);
        if (x < X0 - 30) continue;
        drawStar(x, land[1], 2.4, (0.5 + 0.5 * (1 - smooth(f1, 24, b))) * (0.7 + 0.3 * osc(t, 0.5, e.ph)));
      }
    }
  }
}

function drawHills(now) {
  for (const hl of HILLS) {
    const off = hl.f * now.X, pts = [];
    for (let x = X0 - 12; x <= X1 + 12; x += 12) {
      let y = 0;
      for (const w of hl.waves) y += w.a * Math.sin(2 * Math.PI * w.k * (x + off) / hl.L + w.ph);
      pts.push([x, hl.base - hl.amp * (0.6 + y)]);
    }
    ctx.beginPath(); line(pts); ctx.lineTo(X1 + 12, FLOOR); ctx.lineTo(X0 - 12, FLOOR); ctx.closePath();
    ctx.fillStyle = '#000'; ctx.fill();                // the hills hide the stars behind them
    ctx.beginPath(); line(pts);
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(DIM, hl.alpha * (0.6 + 0.4 * now.light)); ctx.stroke();
  }
}

function drawWind(now, t) {                            // the wind: long thin lines that slide across, stronger in the gusts
  const base = (0.14 + 0.4 * now.wind) * (0.55 + 0.45 * now.light);
  ctx.lineCap = 'round';
  for (const w of WINDS) {
    const span = X1 - X0 + 400 + w.len, head = X1 + 200 - mod(w.ph + t * crossings(w.sec) / periodS(), 1) * span;
    const y0 = lerp(Y0 + 120, FLOOR - 40, w.yf);
    const g = ctx.createLinearGradient(head, 0, head + w.len, 0);
    g.addColorStop(0, rgba(mix(GREEN, WHITE, 0.4), base)); g.addColorStop(1, rgba(GREEN, 0));
    ctx.beginPath();
    for (let j = 0; j <= 18; j++) {
      const x = head + w.len * j / 18, y = y0 + w.amp * Math.sin(2 * Math.PI * x / w.wl + w.ph2);
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.stroke();
  }
}

function drawGround(now, t) {                          // the ground line, the grass and the trees, all bending in the wind
  const { X, wind, light } = now, bend = 0.4 + 0.9 * wind;
  const fg = ctx.createLinearGradient(X0, 0, X1, 0);
  fg.addColorStop(0, 'rgba(0,255,65,0)'); fg.addColorStop(0.15, 'rgba(0,255,65,0.3)'); fg.addColorStop(0.85, 'rgba(0,255,65,0.3)'); fg.addColorStop(1, 'rgba(0,255,65,0)');
  ctx.fillStyle = fg; ctx.fillRect(X0, FLOOR - 0.75, X1 - X0, 1.5);
  ctx.beginPath();
  for (const g of GRASS) {
    const x = tiled(g.wx * PATH, PATH, X, 30);
    if (x > X1 + 30) continue;
    for (let k = 0; k < g.n; k++) {
      const bx = x + (k - g.n / 2) * 4, h = g.h * (1 - 0.18 * k), sway = -bend * h * (0.45 + 0.25 * osc(t, 0.9, g.ph + k));
      ctx.moveTo(bx, FLOOR); ctx.quadraticCurveTo(bx + sway * 0.2, FLOOR - h * 0.6, bx + sway, FLOOR - h);
    }
  }
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(GREEN, 0.3 + 0.25 * light); ctx.stroke();
  for (const tr of TREES) {
    const x = tiled(tr.wx * PATH, PATH, X, 260);
    if (x > X1 + 260) continue;
    const sway = -(0.25 + 0.75 * wind) * (0.75 + 0.25 * osc(t, 0.35, tr.ph)), tips = [];
    ctx.beginPath();
    const branch = (bx, by, ang, len, depth) => {
      const a = ang + sway * (4 - depth) * 0.045;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
      if (depth === 0) { tips.push([ex, ey]); return; }
      branch(ex, ey, a - tr.spread[depth - 1], len * 0.72, depth - 1);
      branch(ex, ey, a + tr.spread[depth - 1] * 0.85, len * 0.68, depth - 1);
    };
    branch(x, FLOOR, -Math.PI / 2 + tr.lean + sway * 0.03, tr.h * 0.36, 4);
    glow(DIM, 0.75 + 0.15 * light, 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(GREEN, 0.4 + 0.25 * light);
    for (const [px, py] of tips) { ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 6.2832); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawPath(now) {                               // the path below the ground line: it sparkles and shimmers
  const { X, B, light } = now, band = Math.min(270, Y1 - FLOOR - 20);
  const mist = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 140);   // a soft glow on the path, just under the ground line
  mist.addColorStop(0, rgba(GREEN, 0.03 + 0.05 * light)); mist.addColorStop(1, rgba(GREEN, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = mist; ctx.fillRect(X0, FLOOR, X1 - X0, 140);
  for (const s of SPARK) {
    const y = FLOOR + 10 + s.yf * 270;
    if (y > FLOOR + 10 + band) continue;
    const f = depthOf(s.yf), L = f * PATH, x = tiled(s.wx * L, L, f * X, 10);
    if (x > X1 + 10) continue;
    const tw = Math.pow(Math.max(0, Math.sin(2 * Math.PI * B / 4 + s.ph)), 3);   // each one twinkles once in each bar
    const a = (0.16 + 0.84 * tw) * (0.6 + 0.4 * light) * (1 - 0.4 * s.yf * s.k);
    if (a < 0.03) continue;
    const r = 1 + 2.4 * s.yf, col = s.k < 0.3 ? WHITE : GREEN;
    ctx.fillStyle = rgba(col, a); ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    if (tw > 0.6 && s.k < 0.5) {                     // at its brightest, a small cross of light
      ctx.fillStyle = rgba(col, a * 0.5); ctx.fillRect(x - 4 * r, y - 0.4, 8 * r, 0.8); ctx.fillRect(x - 0.4, y - 4 * r, 0.8, 8 * r);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + band + 30);   // the far edge of the path fades into the dark
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(X0, FLOOR + 1, X1 - X0, band + 30);
}

function drawTalks(now) {                              // the friends talk: a wifi signal arcs from one head to another
  const { B, friends } = now;
  for (const w of now.talks) {
    if (B < w.t0 || B > w.t1) continue;
    const A = friends[w.from].J, C = friends[w.to].J, dir = Math.sign(C.head[0] - A.head[0]) || 1;
    const a = [A.head[0] + dir * A.headR * 1.3, A.head[1] - A.headR * 0.6], c = [C.head[0] - dir * (C.headR * 1.3 + 4), C.head[1] - C.headR * 0.6];
    const m = bendPoint(a, c, -0.45 * dir), u = clamp01((B - w.t0 - LEAD) / (w.t1 - w.t0 - LEAD));
    const p = quad(a, m, c, u), tg = quadTan(a, m, c, u);
    drawWifi(p, Math.atan2(tg[1], tg[0]), 1.5, friends[w.from].F.color, 1 - smooth(0.9, 1, u), B, (B - w.t0) / LEAD * 3);
  }
}

function drawLeaves(now, t) {                          // leaves carried along by the wind
  for (const l of LEAVES) {
    const x = X1 + 40 - mod(l.ph + t * crossings(l.sec) / periodS(), 1) * (X1 - X0 + 80);
    const y = lerp(Y0 + 220, FLOOR + 80, l.yf) + l.bob * osc(t, 0.23, l.ph2), a = osc(t, 0.3 * l.spin, l.ph2) * 2.4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-l.size, 0); ctx.quadraticCurveTo(0, -l.size * 0.55, l.size, 0); ctx.quadraticCurveTo(0, l.size * 0.55, -l.size, 0);
    ctx.fillStyle = rgba(l.green ? GREEN : WHITE, (0.35 + 0.35 * now.light) * (0.6 + 0.4 * now.wind)); ctx.fill();
    ctx.restore();
  }
}

function drawTitle() {                                 // DIL CHAHTA HAI: centred across, its letters centred at TITLE_Y of the height
  if (!SHOW_TITLE) return;
  ctx.font = '600 92px ' + SANS;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '24px';
  const text = 'DIL CHAHTA HAI', m = ctx.measureText(text), lift = ((m.actualBoundingBoxAscent || 66) - (m.actualBoundingBoxDescent || 0)) / 2;
  const shift = 'letterSpacing' in ctx ? 12 : 0;       // the spacing after the last letter: half of it moves the words off centre
  ctx.fillStyle = rgba(WHITE, 0.88);
  const k = Math.min(1, TITLE_MAX * (X1 - X0) / (m.width - 2 * shift));   // smaller on a narrow screen, such as a phone
  ctx.save(); ctx.translate(VW / 2, TITLE_Y * VH); ctx.scale(k, k);
  ctx.fillText(text, shift, lift);
  ctx.restore();
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

function render(t) {
  const now = scene(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(SC, 0, 0, SC, OX, OY);
  ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, FLOOR - Y0); ctx.clip();   // the sky
  drawSky(now, t);
  drawHills(now);
  drawWind(now, t);
  ctx.restore();
  drawTitle();
  drawGround(now, t);
  drawPath(now);
  drawSongs(now, t);
  for (const o of now.friends) drawScarf(o.f, o.J, o.F.scarf, now.wind, now.walk, t);
  for (const o of now.friends) drawStick(o.f, o.J, o.F.color, 1);
  drawTalks(now);
  drawLeaves(now, t);
}

// The time t of the scene is the time in dch_loop1.mp3, the ten-loop file it was fitted to. The player plays one
// loop, cut at 37 s (two loops) into that file, so its time 0 is t = 37: the end of a night, just before dawn.
const START = 37;

// ---------- on the dex page: fit the canvas, follow the music, draw ----------
// The scene moves only while the music plays: the time of the scene is the time of the music. When the music pauses,
// the scene stops at the same point, and goes on from there when the music plays again.
const music = (cv.parentElement && cv.parentElement.querySelector('loop-audio')) || document.querySelector('loop-audio');
const timeNow = () => START + (music ? music.time : 0);

function fit() {                                       // as sharp as the screen, up to about 3.7 million pixels
  const box = cv.getBoundingClientRect();
  const k = Math.min(window.devicePixelRatio || 1, Math.sqrt(3.7e6 / Math.max(1, box.width * box.height)));
  const w = Math.max(16, Math.round(box.width * k)), h = Math.max(16, Math.round(box.height * k));
  if (w === cv.width && h === cv.height) return false;
  cv.width = W = w; cv.height = H = h;
  place();
  return true;
}

// The scene is 1920 x 1080, but the screen can have any shape. The middle of the scene (the three friends, MIDDLE
// wide) always shows, as big as it can; the sky, the land, the path and the wind fill the rest. On a tall screen,
// most of the extra height goes to the sky.
const MIDDLE = 820;
function place() {
  SC = Math.min(H / VH, W / MIDDLE); OX = W / 2 - VW / 2 * SC; OY = (H - VH * SC) * 0.7;
  X0 = -OX / SC; X1 = (W - OX) / SC; Y0 = -OY / SC; Y1 = (H - OY) / SC;
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
