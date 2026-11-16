/*
  Trouble: the animation for the Trouble (Phantechol) recut loop. A white self on the ground looks up at a green self
  that sits on a ledge far above: out of reach, out of its league. Every eight bars the white self reaches up and
  jumps, and falls short; a tick on the ruler marks how high its hands got. Each try goes higher. On the fourth try
  the hands meet: the green self reaches down, and every failed tick turns green. Then the scene fades and begins again.
  Black, white and green only.

  On a dex page: a <canvas class="loop-anim">, and a <loop-audio> player in the same parent (else the first on the page).
    <span class="loop-stage"><canvas class="loop-anim" width="1920" height="1080"></canvas><loop-audio ...>Name</loop-audio></span>
    <script src="assets/trouble-anim.js" defer></script>
  The canvas can have any size and shape (the page CSS sets it): the scene fills it.
  The animation moves only while the music plays, and follows it to the beat. When the music pauses, it stops.
  A click on the animation plays or pauses the music.
  Josefin Sans (SIL Open Font License 1.1) comes from josefin-sans.woff2 next to this script.
*/
(() => {
'use strict';
const cv = document.querySelector('canvas.loop-anim');
if (!cv || !cv.getContext) return;
const HERE = document.currentScript ? document.currentScript.src : location.href;
// ---------- settings ----------
const BPM = 151.181;                                   // measured from the loop: 32 beats in 12.7 s
const OFFSET = 0.9197;                                 // the first downbeat of the loop, in seconds into the loop
const CB = 32;                                         // beats in one loop (8 bars)
const TRIES = 4;                                       // loops in one video loop: the fourth try succeeds
const SHIFT = 4;                                       // beats: the first picture, before the music plays, is the calm start of try 1
// measured from the loop on each half beat of one 8-bar loop, 0..1: the kick and bass, and the range of the voice
const GROOVE = [0.95, 0.28, 0.02, 0.97, 0.28, 0.02, 0.92, 0.88, 0.33, 0.01, 0.99, 0.91, 0.34, 0.83, 0.6, 0.01, 0.96, 0.31, 0.02, 0.86, 0.67, 0.02, 0.94, 0.91, 0.43, 0.01, 1, 0.9, 0.5, 0.85, 0.62, 0.38, 0.96, 0.4, 0.03, 1, 0.41, 0.02, 0.95, 0.84, 0.56, 0, 0.98, 0.83, 0.57, 0.81, 0.59, 0.11, 0.97, 0.47, 0.04, 0.82, 0.68, 0.09, 0.96, 0.86, 0.65, 0, 0.98, 0.68, 0, 0.96, 0.04, 0.1];
const VOICE = [0.63, 0.27, 0.53, 0.52, 0.08, 0.82, 0.64, 0.68, 0.42, 0.88, 0.35, 0.95, 0.32, 0.95, 0.49, 0.38, 0.3, 0.57, 1, 0.77, 0.38, 0.75, 0.54, 1, 0.77, 1, 0.04, 0.92, 0, 0.98, 0.76, 0.67, 0.55, 0.36, 0.22, 0.36, 0.5, 0.57, 0.7, 0.93, 0.03, 0.89, 0, 0.52, 0.2, 1, 0.78, 0.48, 0.83, 0.5, 0.88, 1, 0.61, 0.67, 0.46, 0.45, 0.83, 0.55, 0.94, 0.61, 0.66, 0.7, 0.3, 0.74];
let W = 1920, H_ = 1080;                               // the canvas size: fit() sets it
const WHITE = [255, 255, 255], GREEN = [0, 255, 65];
const MONO = "'Josefin Sans', sans-serif";
const TITLE_Y = 0.16, TITLE_MAX = 0.6;                 // the middle of the title's letters, as a part of the height from the top
const VW = 1920, VH = 1080;                            // the scene is drawn in this space
const GROUND = 840, LEDGE_Y = 410, FH = 232;           // the ground, the ledge and the height of both selves
const CX = 880, GX = 995, SX = 1000;                   // the white self, the green self, and the middle of the scene
const JUMP = [58, 98, 138, 176];                       // how high each try goes; the fourth one meets the green hand
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
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ---------- the beat ----------
const beatOf = (t) => (t - OFFSET) * BPM / 60;        // beats since the first downbeat
const pulse = (B) => {                                 // the groove: high on each hit of the kick and bass, then falling fast
  const h = B * 2, i = Math.floor(h), fr = h - i;
  return GROOVE[mod(i, 64)] * Math.exp(-fr * 3) + 0.5 * GROOVE[mod(i - 1, 64)] * Math.exp(-(fr + 1) * 3);
};
const PERIOD = TRIES * CB * 60 / BPM;                  // seconds until the whole scene repeats
const osc = (t, f, ph) => Math.sin(2 * Math.PI * Math.max(1, Math.round(f * PERIOD)) / PERIOD * t + ph);   // f in Hz, made to fit
const voiceAt = (B) => {                               // the voice range, smooth between the half beats
  const h = B * 2, i = Math.floor(h);
  return lerp(VOICE[mod(i, 64)], VOICE[mod(i + 1, 64)], smooth(0, 1, h - i));
};

// ---------- one stick figure ----------
function ik(s, t, l1, l2, out) {                       // two-bone limb; the middle joint bends outward (out = -1, 1), or downward (out = 0)
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [s[0] + l1 * Math.cos(th + a), s[1] + l1 * Math.sin(th + a)], e2 = [s[0] + l1 * Math.cos(th - a), s[1] + l1 * Math.sin(th - a)];
  const pick = out === 0 ? e1[1] >= e2[1] : (e1[0] - e2[0]) * out >= 0;   // downward: a swinging arm keeps its elbow below it, with no flip
  return [pick ? e1 : e2, [s[0] + d * Math.cos(th), s[1] + d * Math.sin(th)]];
}
// the white self, standing. p: x, feet, au (arms up), crouch, tip (on tiptoe), tuck (legs pulled up), lean, slump,
// sway, dip, rt (the right hand goes to the point P, which the green hand also reaches)
const ARM = 0.405, UP_R = 160;                         // the arm, as a part of the height; the right arm reaches up and a little to the side (degrees from straight down)
const HAND_UP = GROUND - 1.1 * FH;                     // the height of the right hand when the arm is up and the feet are on the ground
const P_TOUCH = [CX + Math.sin(UP_R * Math.PI / 180) * ARM * FH, HAND_UP - JUMP[3]];   // where the two hands meet
function whiteJoints(p) {
  const h = FH, feet = p.feet - p.tip * 0.03 * h;
  const hip = [p.x + p.sway * h, feet - 0.37 * (1 - 0.3 * p.crouch) * h + p.dip * h];
  const sh = [hip[0] + (p.lean + 0.02 * p.slump) * h, hip[1] - 0.35 * (1 + 0.05 * p.tip) * h + (0.03 * p.slump + 0.02 * p.crouch) * h];
  const head = [sh[0] + (0.02 * p.lean + 0.015 * p.slump) * h, sh[1] - 0.155 * h + 0.012 * p.slump * h];
  const neck = [sh[0], sh[1] - 0.05 * h];
  const reach = (side, deg) => {                       // the hand of an arm that is deg degrees from straight down, going out to the side
    const a = deg * Math.PI / 180, len = lerp(0.39, ARM, p.au) * h;
    return [sh[0] + side * Math.sin(a) * len, sh[1] + Math.cos(a) * len];
  };
  const hL = reach(-1, lerp(20, 150, p.au));
  let hR = reach(1, lerp(20, UP_R, p.au));
  if (p.rt > 0) hR = lerp2(hR, P_TOUCH, p.rt);
  const [eL, hl] = ik(sh, hL, 0.2 * h, 0.21 * h, 0), [eR, hr] = ik(sh, hR, 0.2 * h, 0.21 * h, 0);
  const fy = feet - p.tuck * 0.1 * h;
  const [kL, fl] = ik(hip, [p.x - 0.11 * h, fy], 0.2 * h, 0.2 * h, -1), [kR, fr] = ik(hip, [p.x + 0.11 * h, fy], 0.2 * h, 0.2 * h, 1);
  return { head, headR: 0.105 * h, neck, hip, sh, arms: [[sh, eL, hl], [sh, eR, hr]], legs: [[hip, kL, fl], [hip, kR, fr]], hand: hr };
}
// the green self, sitting on the end of the ledge with its legs over the edge. p: lean (toward the white self, 0..1),
// rg (the near hand reaches down to P, 0..1), swing (its legs), br (breath)
function greenJoints(p) {
  const h = FH, hip = [GX, LEDGE_Y - 0.02 * h];
  const sh = [hip[0] - (0.04 + 0.17 * p.lean) * h, hip[1] - 0.35 * h + p.br * h];
  const head = [sh[0] - 0.035 * p.lean * h, sh[1] - 0.155 * h];
  const neck = [sh[0], sh[1] - 0.05 * h];
  const near = lerp2([hip[0] - 0.13 * h, hip[1] - 0.03 * h], P_TOUCH, p.rg), far = [hip[0] + 0.14 * h, LEDGE_Y - 0.01 * h];
  const [eN, hn] = ik(sh, near, 0.2 * h, 0.21 * h, -1), [eF, hf] = ik(sh, far, 0.2 * h, 0.21 * h, 1);
  const leg = (dx, dy, phi) => {                       // the thigh goes along the ledge, the shin hangs over its end and swings a little
    const k = [hip[0] - dx * h, hip[1] + dy * h];
    return [k, [k[0] + 0.2 * h * Math.sin(phi), k[1] + 0.2 * h * Math.cos(phi)]];
  };
  const [k1, f1] = leg(0.2, 0, 0.22 * p.swing), [k2, f2] = leg(0.165, 0.012, -0.22 * p.swing);
  return { head, headR: 0.105 * h, neck, hip, sh, arms: [[sh, eN, hn], [sh, eF, hf]], legs: [[hip, k1, f1], [hip, k2, f2]], hand: hn };
}

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
// One try is one loop of 32 beats. beats 0-8: it looks up, longing. 8-16: it reaches, as the voice swells. 16-20: it
// crouches. 20-23: the jump. 23-32: it lands short, and the tick stays. The green self leans a little more over the
// ledge after each try. On the fourth try the green hand comes down, the hands meet at beat 21.5, and all the ticks
// turn green; then the green self lowers the white one, and everything fades before the next round.
const TICK_AT = [23, 23, 23, 21.5];                    // the beat of a loop when its tick appears
const LEAN_KEYS = [[0, 0.15], [1, 0.45], [2, 0.75], [3, 1], [3.8, 1], [4, 0.15]];
const leanAt = (gg) => {                               // how far the green self leans, over the four tries
  for (let i = 1; i < LEAN_KEYS.length; i++) if (gg <= LEAN_KEYS[i][0]) {
    const a = LEAN_KEYS[i - 1], b = LEAN_KEYS[i];
    return lerp(a[1], b[1], smooth(a[0], b[0], gg));
  }
  return LEAN_KEYS[0][1];
};

function scene(t) {
  const B = beatOf(t), g = mod(B + SHIFT, TRIES * CB), n = Math.floor(g / CB), Bl = g - n * CB;
  const vs = voiceAt(B), last = n === TRIES - 1;
  // the white self
  let up = 0, tuck = 0, landing = 0;
  const tau = (Bl - 20) / 3;
  if (!last) {
    if (tau > 0 && tau < 1) { up = 4 * JUMP[n] * tau * (1 - tau); tuck = 0.5 * Math.sin(Math.PI * tau); }
    landing = 0.75 * win(Bl, 22.9, 24.6, 0.5);
  } else {
    if (Bl < 21.5) up = Bl > 20 ? 4 * JUMP[n] * tau * (1 - tau) : 0;
    else if (Bl < 24) up = JUMP[n];
    else up = JUMP[n] * (1 - smooth(24, 28.5, Bl));
    tuck = 0.3 * smooth(21.5, 22.6, Bl) * (1 - smooth(26, 28.5, Bl)) + (tau > 0 && tau < 0.5 ? 0.45 * Math.sin(2 * Math.PI * tau) : 0);
    landing = 0.35 * win(Bl, 28, 29.8, 0.6);
  }
  const coil = 0.9 * smooth(16, 19.6, Bl) * (1 - smooth(19.65, 20.1, Bl));
  const armsOut = last ? 1 - smooth(27, 30.5, Bl) : 1 - smooth(24.5, 30, Bl);
  const jumpArms = smooth(19, 20, Bl) * (1 - smooth(last ? 27 : 24, last ? 28 : 25, Bl));   // fully up for the jump
  const au = Math.max(smooth(6, 14, Bl) * armsOut * (0.72 + 0.28 * vs), jumpArms);
  const tip = smooth(9, 19, Bl) * (1 - smooth(19.8, 20.2, Bl));
  const slump = last ? 0 : 0.8 * win(Bl, 23.3, 29, 1.2);
  const airborne = clamp01(up / 12);
  const w = {
    x: CX, feet: GROUND - up, au, crouch: Math.min(1, coil + landing), tip, tuck, lean: 0.015 * Math.sin(2 * Math.PI * Bl / CB), slump,
    sway: 0.004 * osc(t, 0.2, 0), dip: (0.012 + 0.014 * pulse(B)) * (1 - airborne) * (1 - 0.5 * au),
    rt: last ? smooth(20.8, 21.5, Bl) * (1 - smooth(27, 28.2, Bl)) : 0,
  };
  // the green self
  const gl = leanAt(g / CB) + 0.12 * win(Bl, 17.5, 24.5, 1.5);
  const reach = last ? smooth(18.5, 21.3, Bl) * (1 - smooth(27.5, 30.5, Bl)) : 0.12 * win(Bl, 19.5, 24, 1.5) * (n === 2 ? 1 : 0);
  const gr = { lean: Math.min(1, gl), rg: reach, swing: Math.sin(Math.PI * B / 8), br: 0.004 * osc(t, 0.18, 1) };
  // touch: how strongly the hands are together, and when
  const touch = last ? smooth(21.3, 21.9, Bl) * (1 - smooth(27.5, 30.5, Bl)) : 0;
  return { B, g, n, Bl, vs, last, W: whiteJoints(w), G: greenJoints(gr), up, touch };
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

function drawGlow(S) {                                 // a soft green light behind the green self, a little stronger as the voice swells
  const c = S.G.sh, r = 260, a = 0.05 + 0.06 * S.vs + 0.3 * S.touch;
  const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
  g.addColorStop(0, rgba(GREEN, a)); g.addColorStop(1, rgba(GREEN, 0));
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r);
  ctx.globalCompositeOperation = 'source-over';
}

function drawRuler(S) {                                // the ticks: how high each try got
  const x = 716, top = P_TOUCH[1] - 26;
  ctx.fillStyle = rgba(WHITE, 0.22); ctx.fillRect(x - 1, top, 2, GROUND - top);
  ctx.fillStyle = rgba(WHITE, 0.4); ctx.fillRect(x - 1, GROUND - 1, 30, 2);
  for (let i = 0; i < TRIES; i++) {
    let a = S.n > i ? 1 : S.n === i ? smooth(TICK_AT[i], TICK_AT[i] + 1, S.Bl) : 0;
    let k = 0;
    if (S.last) { a *= 1 - smooth(29.5, 31.8, S.Bl); k = smooth(21.6 + 0.45 * i, 22.6 + 0.45 * i, S.Bl); }
    if (a <= 0) continue;
    const y = HAND_UP - JUMP[i], c = mix(WHITE, GREEN, k), len = 30 + 10 * k;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.18 * a); ctx.fillRect(x - 1, y - 5, len + 2, 10);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba(c, 0.9 * a); ctx.fillRect(x - 1, y - 1.5, len, 3);
  }
}

function drawLink(S) {                                 // a dotted line from the reaching hand to the green hand: the distance
  const a = S.W.hand, b = S.G.hand, d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const al = 0.6 * clamp01(S.W.arms[1][2][1] < GROUND - 0.5 * FH ? 1 : 0) * smooth(6, 14, S.Bl) * (1 - S.touch) * smooth(0, 14, d);
  if (al <= 0.01) return;
  ctx.save();
  ctx.setLineDash([1, 11]); ctx.lineDashOffset = -S.B * 11; ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(GREEN, al); ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.restore();
}

function drawDust(S) {                                 // a small puff at the feet when a try lands short
  if (S.last) return;
  const age = (S.Bl - 23) / 1.7;
  if (age <= 0 || age >= 1) return;
  for (let k = 0; k < 8; k++) {
    const dir = k < 4 ? -1 : 1, j = k % 4, d = (20 + 34 * j) * easeOut(age), lift = (10 + 6 * j) * Math.sin(Math.PI * Math.min(1, age * 1.3));
    ctx.beginPath(); ctx.arc(CX + dir * d, GROUND - 6 - lift, 2.6 - 0.35 * j, 0, 6.2832);
    ctx.fillStyle = rgba(WHITE, 0.55 * (1 - age)); ctx.fill();
  }
}

function drawRings(S) {                                // two green rings spread out from the touch
  if (!S.last) return;
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
  drawRuler(S);
  drawTitle();
  drawLink(S);
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

// The scene is 1920 x 1080, but the screen can have any shape. The middle of the scene (the ruler, the two selves and
// the ledge: KEY_W wide, KEY_H high) always shows, as big as it can; the rest is black.
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
