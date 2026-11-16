/*
  Trouble: the animation for the Trouble (Phantechol) recut loop. A white self on the ground looks up at a green self
  that sits on a ledge far above: out of reach, out of its league. In every loop of the song the white self reaches up
  and jumps, and falls short, twice. The third jump meets the green hand: the green self reaches down, and green rings
  spread out from the touch. Then the white self comes down, and the loop begins again.
  Black, white and green only.

  On a dex page: a <canvas class="loop-anim">, and a <loop-audio> player in the same parent (else the first on the page).
    <span class="loop-stage"><canvas class="loop-anim" width="1920" height="1080"></canvas><loop-audio ...>Name</loop-audio></span>
    <script src="assets/trouble-anim.js" defer></script>
  The canvas can have any size and shape (the page CSS sets it): the scene fills it.
  The animation moves only while the music plays, and it begins again with every loop of the song (12.7 s). It does not
  follow the beat or the voice: it only keeps the length of the loop. When the music pauses, it stops.
  A click on the animation plays or pauses the music.
  Josefin Sans (SIL Open Font License 1.1) comes from josefin-sans.woff2 next to this script.
*/
(() => {
'use strict';
const cv = document.querySelector('canvas.loop-anim');
if (!cv || !cv.getContext) return;
const HERE = document.currentScript ? document.currentScript.src : location.href;
// ---------- settings ----------
const LOOP = 12.7;                                     // seconds in one loop of the song: the whole story is one loop long
const CB = 32;                                         // the story is told in 32 steps; a step is 1/32 of a loop
let W = 1920, H_ = 1080;                               // the canvas size: fit() sets it
const WHITE = [255, 255, 255], GREEN = [0, 255, 65];
const MONO = "'Josefin Sans', sans-serif";
const TITLE_Y = 0.16, TITLE_MAX = 0.6;                 // the middle of the title's letters, as a part of the height from the top
const VW = 1920, VH = 1080;                            // the scene is drawn in this space
const GROUND = 840, LEDGE_Y = 410, FH = 232;           // the ground, the ledge and the height of both selves
const CX = 865, GX = 995, SX = 1000;                   // the white self, the green self, and the middle of the scene
const JUMP = [52, 96, 176];                            // how high each jump goes: the third one meets the green hand
const fontReady = (() => {                             // Josefin Sans, from the file next to this script
  try {
    const face = new FontFace('Josefin Sans', 'url(' + new URL('josefin-sans.woff2', HERE).href + ')', { weight: '100 700' });
    document.fonts.add(face);
    return Promise.race([face.load(), new Promise((ok) => setTimeout(ok, 4000))]).catch(() => {});
  } catch (e) { return Promise.resolve(); }
})();

// ---------- small helpers ----------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const win = (t, a, b, d) => smooth(a, a + d, t) * (1 - smooth(b - d, b, t));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const mod = (a, n) => ((a % n) + n) % n;
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
const RAD = Math.PI / 180;

// ---------- the loop ----------
const PERIOD = LOOP;                                   // seconds until the whole scene repeats: one loop of the song
const osc = (t, f, ph) => Math.sin(2 * Math.PI * Math.max(1, Math.round(f * PERIOD)) / PERIOD * t + ph);   // f in Hz, made to fit

// ---------- the green self: sitting on the end of the ledge ----------
function ik(s, t, l1, l2, out) {                       // two-bone limb; the middle joint bends outward (out = -1, 1)
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [s[0] + l1 * Math.cos(th + a), s[1] + l1 * Math.sin(th + a)], e2 = [s[0] + l1 * Math.cos(th - a), s[1] + l1 * Math.sin(th - a)];
  return [(e1[0] - e2[0]) * out >= 0 ? e1 : e2, [s[0] + d * Math.cos(th), s[1] + d * Math.sin(th)]];
}
// p: lean (toward the white self, 0..1), rg (the near hand reaches down to the white hand, 0..1), swing (its legs), br (breath)
function greenJoints(p, reachTo) {
  const h = FH, hip = [GX, LEDGE_Y - 0.02 * h];
  const sh = [hip[0] - (0.04 + 0.17 * p.lean) * h, hip[1] - 0.35 * h + p.br * h];
  const head = [sh[0] - 0.035 * p.lean * h, sh[1] - 0.155 * h];
  const neck = [sh[0], sh[1] - 0.05 * h];
  const near = lerp2([hip[0] - 0.13 * h, hip[1] - 0.03 * h], reachTo, p.rg), far = [hip[0] + 0.14 * h, LEDGE_Y - 0.01 * h];
  const [eN, hn] = ik(sh, near, 0.2 * h, 0.21 * h, -1), [eF, hf] = ik(sh, far, 0.2 * h, 0.21 * h, 1);
  const leg = (dx, dy, phi) => {                       // the thigh goes along the ledge, the shin hangs over its end and swings a little
    const k = [hip[0] - dx * h, hip[1] + dy * h];
    return [k, [k[0] + 0.2 * h * Math.sin(phi), k[1] + 0.2 * h * Math.cos(phi)]];
  };
  const [k1, f1] = leg(0.2, 0, 0.22 * p.swing), [k2, f2] = leg(0.165, 0.012, -0.22 * p.swing);
  return { head, headR: 0.105 * h, neck, hip, sh, arms: [[sh, eN, hn], [sh, eF, hf]], legs: [[hip, k1, f1], [hip, k2, f2]], hand: hn };
}

// ---------- the white self ----------
// Every pose is written as angles, and the body is built from them (no solver that can flip). Between two poses, every
// angle moves smoothly, so nothing jumps. A limb has two angles: the upper part, and the lower part, each in degrees
// from straight down, positive going out to the side (90 is level, 180 is straight up).
//   lean (the body, positive to the right, toward the ledge), hd (the head, the same way), hup (the head rises),
//   aL, aR (the arms: upper, lower), lL, lR (the legs: thigh, shin), rise (on tiptoe, in heights)
const POSES = {
  idle:   { lean: 0,  hd: 4,  hup: 0.010, aL: [15, 9],     aR: [15, 9],      lL: [9, 4],  lR: [9, 4],  rise: 0 },      // stands, looks up
  reach:  { lean: 4,  hd: 9,  hup: 0.020, aL: [24, 14],    aR: [146, 154],   lL: [6, 2],  lR: [6, 2],  rise: 0.028 },  // the right arm reaches toward the ledge
  crouch: { lean: 8,  hd: 8,  hup: 0,     aL: [48, 34],    aR: [78, 62],     lL: [34, -5], lR: [34, -5], rise: 0 },    // knees out, ready to jump
  launch: { lean: 3,  hd: 8,  hup: 0.022, aL: [150, 158],  aR: [160, 166],   lL: [4, 1],  lR: [4, 1],  rise: 0 },      // stretched, arms up
  air:    { lean: 3,  hd: 9,  hup: 0.022, aL: [138, 150],  aR: [156, 164],   lL: [20, -12], lR: [20, -12], rise: 0 },  // at the top, legs tucked
  land:   { lean: 7,  hd: 3,  hup: 0,     aL: [38, 22],    aR: [38, 22],     lL: [28, -4], lR: [28, -4], rise: 0 },    // knees bend as the feet land
  slump:  { lean: -5, hd: -14, hup: -0.012, aL: [9, 5],    aR: [9, 5],       lL: [8, 3],  lR: [8, 3],  rise: 0 },      // fell short: head down
  touch:  { lean: 5,  hd: 9,  hup: 0.022, aL: [142, 152],  aR: [158, 160],   lL: [10, 5], lR: [8, 3],  rise: 0 },      // the right hand meets the green hand
};
const LEN = { torso: 0.35, neck: 0.05, head: 0.155, upper: 0.2, lower: 0.21, thigh: 0.2, shin: 0.2 };
function whiteJoints(P, up, breath) {
  const h = FH, a = (side, [u, l]) => [[side * Math.sin(u * RAD), Math.cos(u * RAD)], [side * Math.sin(l * RAD), Math.cos(l * RAD)]];
  const legs = [-1, 1].map((side, i) => a(side, i ? P.lR : P.lL)), drop = legs.map((l) => (LEN.thigh * l[0][1] + LEN.shin * l[1][1]) * h);
  const hip = [CX, GROUND - up - P.rise * h - Math.max(drop[0], drop[1])];     // the lowest foot stands on the ground, or on the air
  const lean = P.lean * RAD, hd = (P.lean + P.hd) * RAD;
  const sh = [hip[0] + LEN.torso * h * Math.sin(lean), hip[1] - LEN.torso * h * Math.cos(lean) + breath * h];
  const neck = [sh[0] + LEN.neck * h * Math.sin(lean), sh[1] - LEN.neck * h * Math.cos(lean)];
  const head = [sh[0] + (LEN.head + P.hup) * h * Math.sin(hd), sh[1] - (LEN.head + P.hup) * h * Math.cos(hd)];
  const limb = (from, d1, d2, l1, l2) => { const e = [from[0] + d1[0] * l1 * h, from[1] + d1[1] * l1 * h]; return [from, e, [e[0] + d2[0] * l2 * h, e[1] + d2[1] * l2 * h]]; };
  const arms = [-1, 1].map((side, i) => { const [d1, d2] = a(side, i ? P.aR : P.aL); return limb(sh, d1, d2, LEN.upper, LEN.lower); });
  const lg = legs.map(([d1, d2]) => limb(hip, d1, d2, LEN.thigh, LEN.shin));
  return { head, headR: 0.105 * h, neck, hip, sh, arms, legs: lg, hand: arms[1][2] };
}
// the story of one loop, in steps (1/32 of a loop) from the start: when the white self is in which pose
const STORY = [
  [0, 'idle'], [5, 'idle'],                            // it looks up, longing
  [6.6, 'reach'], [7.0, 'reach'], [7.8, 'crouch'],     // the right arm reaches, the knees bend
  [8.7, 'launch'], [9.2, 'air'], [10.1, 'land'],       // jump 1: the arms swing up as it takes off; it falls short and lands
  [11, 'reach'], [11.3, 'reach'], [12, 'crouch'],
  [12.8, 'launch'], [13.2, 'air'], [14.1, 'land'],     // jump 2: higher, and falls short
  [15, 'slump'], [17, 'slump'], [18.2, 'idle'],        // it looks down; then it looks up again
  [19.5, 'crouch'], [20.7, 'launch'], [21.5, 'touch'], // jump 3: the hands meet
  [24, 'touch'], [26, 'air'], [28.1, 'land'],          // the green self lets go; it comes down
  [30, 'idle'], [32, 'idle'],
];
function poseAt(Bl) {
  let i = 1; while (i < STORY.length - 1 && STORY[i][0] <= Bl) i++;
  const [b0, n0] = STORY[i - 1], [b1, n1] = STORY[i], k = smooth(b0, b1, Bl), A = POSES[n0], B = POSES[n1], P = {};
  for (const key of Object.keys(A)) P[key] = Array.isArray(A[key]) ? [lerp(A[key][0], B[key][0], k), lerp(A[key][1], B[key][1], k)] : lerp(A[key], B[key], k);
  return P;
}
// how high the feet are above the ground, in scene pixels: three jumps, each a smooth arc
function upAt(Bl) {
  const arc = (from, to, J) => { const u = (Bl - from) / (to - from); return 4 * J * u * (1 - u) * smooth(0, 0.15, u) * smooth(1, 0.85, u); };   // push off and land softly
  if (Bl > 8 && Bl < 10) return arc(8, 10, JUMP[0]);
  if (Bl > 12 && Bl < 14) return arc(12, 14, JUMP[1]);
  if (Bl > 20 && Bl < 21.5) { const u = (Bl - 20) / 1.5; return JUMP[2] * u * (2 - u) * smooth(0, 0.15, u); }   // up to the top in 1.5 steps
  if (Bl >= 21.5 && Bl < 24) return JUMP[2];                                              // held by the green hand
  if (Bl >= 24 && Bl < 28) return JUMP[2] * (1 - smooth(24, 28, Bl));                      // let go, it comes down
  return 0;
}
const P_TOUCH = whiteJoints(POSES.touch, JUMP[2], 0).hand;           // where the two hands meet

const ctx = cv.getContext('2d', { alpha: false });
let SC = 1, OX = 0, OY = 0;                            // from the scene to the canvas: place() sets them
let X0 = 0, X1 = VW;                                   // the part of the scene that is on the screen

function drawFigure(J, color, alpha) {
  if (alpha <= 0) return;
  const lw = Math.max(1.4, FH * 0.032);
  ctx.beginPath(); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832); ctx.fillStyle = '#000'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(J.hip[0], J.hip[1]); ctx.lineTo(J.neck[0], J.neck[1]);
  for (const a of J.arms) { ctx.moveTo(a[0][0], a[0][1]); ctx.lineTo(a[1][0], a[1][1]); ctx.lineTo(a[2][0], a[2][1]); }
  for (const l of J.legs) { ctx.moveTo(l[0][0], l[0][1]); ctx.lineTo(l[1][0], l[1][1]); ctx.lineTo(l[2][0], l[2][1]); }
  ctx.moveTo(J.head[0] + J.headR, J.head[1]); ctx.arc(J.head[0], J.head[1], J.headR, 0, 6.2832);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.16 * alpha); ctx.lineWidth = lw * 2.8; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = lw; ctx.stroke();
}

// ---------- the story ----------
// One loop is 32 steps. 0-5: the white self looks up, longing. 6.6-10: it reaches and jumps, and falls short.
// 11-14: again, higher, and short again. 14.9-18: it looks down, then up. 20-21.5: the third jump takes off, and the
// green self reaches down: the hands meet at step 21.5, and green rings spread out from the touch.
// 24-28: the green self lets go and the white self comes down. 28-32: it settles, and it is the calm start again.
// The green self leans a little more over the ledge as the tries go on. Nothing here follows the beat of the music.
const LEAN_KEYS = [[0, 0.15], [8, 0.2], [12, 0.45], [16, 0.6], [20, 0.95], [28, 0.95], [32, 0.15]];
const leanAt = (Bl) => {                               // how far the green self leans over the ledge
  for (let i = 1; i < LEAN_KEYS.length; i++) if (Bl <= LEAN_KEYS[i][0]) {
    const a = LEAN_KEYS[i - 1], b = LEAN_KEYS[i];
    return lerp(a[1], b[1], smooth(a[0], b[0], Bl));
  }
  return LEAN_KEYS[0][1];
};

function scene(t) {
  const Bl = mod(t, PERIOD) / PERIOD * CB;             // the step of the loop
  const pose = poseAt(Bl), up = upAt(Bl);
  const Wj = whiteJoints(pose, up, 0.004 * osc(t, 0.33, 0));      // a slow breath, never a twitch
  // touch: how strongly the hands are together, and when
  const touch = smooth(21.3, 21.9, Bl) * (1 - smooth(24, 24.8, Bl));
  const reach = smooth(18.6, 21.3, Bl) * (1 - smooth(24, 26.5, Bl)) + 0.1 * win(Bl, 12.5, 15.5, 1);   // the green hand comes down
  const Gj = greenJoints({ lean: leanAt(Bl), rg: Math.min(1, reach), swing: Math.sin(Math.PI * Bl / 8), br: 0.004 * osc(t, 0.18, 1) }, P_TOUCH);
  return { Bl, pose, W: Wj, G: Gj, up, touch };
}

// ---------- drawing ----------
function drawGround() {
  const g = ctx.createLinearGradient(SX - 380, 0, SX + 380, 0);
  g.addColorStop(0, rgba(WHITE, 0)); g.addColorStop(0.18, rgba(WHITE, 0.34)); g.addColorStop(0.82, rgba(WHITE, 0.34)); g.addColorStop(1, rgba(WHITE, 0));
  ctx.fillStyle = g; ctx.fillRect(SX - 380, GROUND, 760, 2);
  const e = GX - 0.2 * FH - 10;                        // the ledge ends just past the green self's knees
  const l = ctx.createLinearGradient(e, 0, e + 480, 0);
  l.addColorStop(0, rgba(WHITE, 0.55)); l.addColorStop(0.7, rgba(WHITE, 0.3)); l.addColorStop(1, rgba(WHITE, 0));
  ctx.fillStyle = l; ctx.fillRect(e, LEDGE_Y, 480, 2);
}

function drawGlow(S) {                                 // a soft green light behind the green self, brighter when the hands meet
  const c = S.G.sh, r = 260, a = 0.08 + 0.3 * S.touch;
  const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
  g.addColorStop(0, rgba(GREEN, a)); g.addColorStop(1, rgba(GREEN, 0));
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r);
  ctx.globalCompositeOperation = 'source-over';
}

function drawDust(S) {                                 // a small puff at the feet when a jump lands short
  for (const land of [10, 14]) {
    const age = (S.Bl - land) / 1.7;
    if (age <= 0 || age >= 1) continue;
    for (let k = 0; k < 8; k++) {
      const dir = k < 4 ? -1 : 1, j = k % 4, d = (20 + 34 * j) * easeOut(age), lift = (10 + 6 * j) * Math.sin(Math.PI * Math.min(1, age * 1.3));
      ctx.beginPath(); ctx.arc(CX + dir * d, GROUND - 6 - lift, 2.6 - 0.35 * j, 0, 6.2832);
      ctx.fillStyle = rgba(WHITE, 0.55 * (1 - age)); ctx.fill();
    }
  }
}

function drawRings(S) {                                // two green rings spread out from the touch
  const s = S.Bl - 21.5;
  for (let k = 0; k < 2; k++) {
    const u = (s - 0.8 * k) / 3.2;
    if (u <= 0 || u >= 1) continue;
    ctx.beginPath(); ctx.arc(P_TOUCH[0], P_TOUCH[1], 16 + 300 * easeOut(u), 0, 6.2832);
    ctx.strokeStyle = rgba(GREEN, 0.7 * (1 - u)); ctx.lineWidth = 2.2; ctx.stroke();
  }
}

function drawTitle() {                                 // TROUBLE: centred across, its letters centred at TITLE_Y of the height
  ctx.font = '600 92px ' + MONO;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '24px';
  const text = 'TROUBLE', m = ctx.measureText(text), lift = ((m.actualBoundingBoxAscent || 66) - (m.actualBoundingBoxDescent || 0)) / 2;
  const shift = 'letterSpacing' in ctx ? 12 : 0;       // the spacing after the last letter: half of it moves the words off centre
  ctx.fillStyle = rgba(WHITE, 0.88);
  const k = Math.min(1, TITLE_MAX * (X1 - X0) / (m.width - 2 * shift));   // smaller on a narrow screen, such as a phone
  ctx.save(); ctx.translate(SX, TITLE_Y * VH); ctx.scale(k, k);
  ctx.fillText(text, shift, lift);
  ctx.restore();
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

function render(t) {
  const S = scene(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H_);
  ctx.setTransform(SC, 0, 0, SC, OX, OY);
  drawGlow(S);
  drawGround();
  drawTitle();
  drawFigure(S.G, GREEN, 1);
  drawFigure(S.W, WHITE, 1);
  drawDust(S);
  drawRings(S);
}

// ---------- on the dex page: fit the canvas, follow the music, draw ----------
// The scene moves only while the music plays: the time of the scene is the time of the music. When the music pauses,
// the scene stops at the same point, and goes on from there when the music plays again.
const music = (cv.parentElement && cv.parentElement.querySelector('loop-audio')) || document.querySelector('loop-audio');
const timeNow = () => (music ? music.time : 0);

function fit() {                                       // as sharp as the screen, up to about 3.7 million pixels
  const box = cv.getBoundingClientRect();
  const k = Math.min(window.devicePixelRatio || 1, Math.sqrt(3.7e6 / Math.max(1, box.width * box.height)));
  const w = Math.max(16, Math.round(box.width * k)), h = Math.max(16, Math.round(box.height * k));
  if (w === cv.width && h === cv.height) return false;
  cv.width = W = w; cv.height = H_ = h;
  place();
  return true;
}

// The scene is 1920 x 1080, but the screen can have any shape. The middle of the scene (the two selves and the
// ledge: KEY_W wide, KEY_H high) always shows, as big as it can; the rest is black.
const KEY_W = 760, KEY_H = 882, KEY_Y = 110;           // its middle is the gap between the selves, where the play button shows
function place() {
  SC = Math.min(W / KEY_W, H_ / KEY_H);
  OX = W / 2 - SX * SC; OY = (H_ - KEY_H * SC) / 2 - KEY_Y * SC;
  X0 = -OX / SC; X1 = (W - OX) / SC;
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
cv.loopAnim = { time: timeNow, render, scene };        // for tests
fontReady.then(() => { ready = true; wake(); });   // no frame with a stand-in font
})();
