/*
  <loop-audio>: a song loop that plays without end and without a gap, with a play button and a volume slider.

  Web Audio plays one decoded loop with loopStart and loopEnd, so the join is exact to the sample. The file holds one
  loop and a little spare audio at each end (the first frames after an MP3 cut do not decode cleanly).

    <script src="loop-audio.js"></script>
    <loop-audio src="obsolete.loop.mp3" loop-start="0.32302" loop-length="18.5">Obsolete</loop-audio>

  Attributes
    src           the loop file
    loop-start    seconds into the file where the loop starts
    loop-length   seconds in one loop
    volume        0 to 1 (default 0.8, or the last volume the visitor set on this site)
    preload       load the file before the first click

  Properties: playing, time (seconds of music played, counting every loop: use it to drive an animation), loopTime
  (seconds into the loop). Methods: play(), pause(), toggle(). Events: 'play', 'pause', 'error'.
  While it plays, the element has the attribute playing. The page CSS can style the parts button, volume and label,
  for example loop-audio[playing]::part(button) { opacity: 0; }
  Only one <loop-audio> plays at a time on a page. Browsers play sound only after the visitor clicks, so the button
  starts it. Serve the page over http(s): browsers do not let a page fetch files from file://.
*/
(() => {
  if (customElements.get('loop-audio')) return;
  let ctx = null;
  const audio = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
  const heard = () => {                               // the time in the audio context that is coming out of the speakers now
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  };
  const players = new Set();
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } } };
  const PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z" fill="currentColor"/></svg>';

  class LoopAudio extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host { display: inline-flex; align-items: center; gap: .7em; color: inherit; font: inherit; vertical-align: middle; }
        button { all: unset; box-sizing: border-box; cursor: pointer; width: 2.4em; height: 2.4em; border-radius: 50%;
                 display: grid; place-items: center; color: #00ff41; border: 1px solid currentColor; }
        button svg { width: 30%; height: 30%; }
        button:hover { background: rgba(0, 255, 65, .12); }
        button:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        button[aria-busy='true'] { opacity: .5; cursor: progress; }
        button.err { color: #fff; border-style: dashed; }
        input { width: 7.5em; accent-color: #00ff41; cursor: pointer; }
      </style>
      <button part="button" type="button" aria-label="Play">${PLAY}</button>
      <input part="volume" type="range" min="0" max="100" step="1" aria-label="Volume">
      <span part="label"><slot></slot></span>`;
      this._btn = root.querySelector('button');
      this._vol = root.querySelector('input');
      this._btn.addEventListener('click', () => this.toggle());
      this._vol.addEventListener('input', () => this._setVolume(this._vol.value / 100, true));
      this._src = null; this._pos = 0; this._from = 0; this._load = null; this._gainNode = null;
    }
    connectedCallback() {
      players.add(this);
      const saved = parseFloat(store.get('loop-audio-volume')), attr = parseFloat(this.getAttribute('volume'));
      this._setVolume(Number.isFinite(saved) ? saved : Number.isFinite(attr) ? attr : 0.8, false);
      const name = this.textContent.trim();
      if (name) { this._btn.setAttribute('aria-label', 'Play ' + name); this._vol.setAttribute('aria-label', 'Volume of ' + name); }
      if (this.hasAttribute('preload')) this.load().catch(() => {});
    }
    disconnectedCallback() { players.delete(this); this.pause(); }

    get loopStart() { const v = parseFloat(this.getAttribute('loop-start')); return Number.isFinite(v) && v >= 0 ? v : 0; }
    get loopLength() { const v = parseFloat(this.getAttribute('loop-length')); return Number.isFinite(v) && v > 0 ? v : null; }
    get playing() { return !!this._src; }
    get time() { return this._src ? Math.max(this._from, heard() - this._t0) : this._pos; }   // not before the start point
    get loopTime() { const n = this._len || this.loopLength; return n ? this.time % n : this.time; }

    load() {                                           // fetch and decode once; decoding needs no click
      if (!this._load) {
        this._load = fetch(this.getAttribute('src'))
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + r.url); return r.arrayBuffer(); })
          .then((b) => new Promise((ok, bad) => audio().decodeAudioData(b, ok, bad)));
        this._load.catch((e) => this._fail(e));
      }
      return this._load;
    }
    async play() {
      if (this._src || this._starting) return;
      this._starting = true;
      this._btn.setAttribute('aria-busy', 'true');
      try {
        const ac = audio();
        if (ac.state !== 'running') await ac.resume();
        const buf = await this.load();
        for (const p of players) if (p !== this) p.pause();   // one song at a time
        const len = Math.min(this.loopLength || buf.duration - this.loopStart, buf.duration - this.loopStart);
        const s = ac.createBufferSource();
        s.buffer = buf; s.loop = true; s.loopStart = this.loopStart; s.loopEnd = this.loopStart + len;
        s.connect(this._gain());
        const at = ac.currentTime + 0.05;
        s.start(at, this.loopStart + (this._pos % len));
        this._src = s; this._len = len;
        this._t0 = at - this._pos;                     // time = what is heard now (heard() counts the output delay)
        this._from = this._pos;
        this._show(true);
        this.dispatchEvent(new Event('play'));
      } catch (e) { this._fail(e); }
      finally { this._starting = false; this._btn.removeAttribute('aria-busy'); }
    }
    pause() {
      if (!this._src) return;
      this._pos = this.time;
      try { this._src.stop(); } catch (e) { /* already stopped */ }
      this._src.disconnect(); this._src = null;
      this._show(false);
      this.dispatchEvent(new Event('pause'));
    }
    toggle() { return this._src ? this.pause() : this.play(); }

    _gain() {
      if (!this._gainNode) { this._gainNode = audio().createGain(); this._gainNode.connect(audio().destination); this._applyGain(true); }
      return this._gainNode;
    }
    _setVolume(v, byVisitor) {
      this._v = Math.max(0, Math.min(1, v));
      this._vol.value = Math.round(this._v * 100);
      this._vol.setAttribute('aria-valuetext', Math.round(this._v * 100) + '%');
      if (byVisitor) store.set('loop-audio-volume', String(this._v));
      this._applyGain(false);
    }
    _applyGain(now) {                                  // a square curve feels even to the ear; a short glide avoids clicks
      if (!this._gainNode) return;
      const g = this._v * this._v, p = this._gainNode.gain;
      if (now) p.value = g; else p.setTargetAtTime(g, ctx.currentTime, 0.03);
    }
    _show(on) {
      this.toggleAttribute('playing', on);
      this._btn.innerHTML = on ? PAUSE : PLAY;
      const name = this.textContent.trim();
      this._btn.setAttribute('aria-label', (on ? 'Pause' : 'Play') + (name ? ' ' + name : ''));
    }
    _fail(e) {
      this._btn.classList.add('err');
      this._btn.title = 'Could not play: ' + (e && e.message ? e.message : e);
      this.dispatchEvent(new CustomEvent('error', { detail: e }));
      console.error('loop-audio:', e);
    }
  }
  customElements.define('loop-audio', LoopAudio);
})();
