// IRON TIDE — audio: everything is synthesized with WebAudio, no audio
// files. Four radio stations are tiny step-sequencers with different
// scales, tempos and waveforms; SFX are short oscillator/noise bursts.
// Audio starts only after the first user gesture (browser autoplay rule).
import { STATIONS } from './tuning.js';

const SCALES = {
  rust:  [110, 130.8, 146.8, 164.8, 196, 220],   // minor rock riff
  neon:  [87.3, 110, 130.8, 164.8, 196, 261.6],  // synthwave arpeggio
  talk:  [220, 233, 246.9, 220],                 // low talk murmur bed
  jazz:  [130.8, 164.8, 196, 246.9, 293.7, 329.6], // rainy piano-ish
};
const TEMPO = { rust: 132, neon: 112, talk: 60, jazz: 78 };
const WAVE = { rust: 'sawtooth', neon: 'square', talk: 'sine', jazz: 'triangle' };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.muted = false;
    this._step = 0;
    this._timer = null;
    this._master = null;
    this._radioGain = null;
    this._noiseBuf = null;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._master = this.ctx.createGain();
    this._master.gain.value = 0.5;
    this._master.connect(this.ctx.destination);
    this._radioGain = this.ctx.createGain();
    this._radioGain.gain.value = 0.14;
    this._radioGain.connect(this._master);
    const len = this.ctx.sampleRate * 1;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    this.startRadio();
  }
  stationName() { return STATIONS[this.station].name; }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this._step = 0;
    return this.stationName();
  }
  startRadio() {
    if (this._timer || !this.ctx) return;
    const tick = () => {
      if (this.muted) return;
      const st = STATIONS[this.station];
      const scale = SCALES[st.id];
      const beat = 60 / TEMPO[st.id] / 2;
      const note = scale[this._step % scale.length] * (this._step % 8 === 4 ? 2 : 1);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = WAVE[st.id];
      o.frequency.value = note;
      g.gain.setValueAtTime(0.5, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beat * 0.95);
      o.connect(g); g.connect(this._radioGain);
      o.start(); o.stop(this.ctx.currentTime + beat);
      // a soft bass note every fourth step
      if (this._step % 4 === 0) {
        const b = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        b.type = 'sine';
        b.frequency.value = scale[0] / 2;
        bg.gain.setValueAtTime(0.6, this.ctx.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beat * 3.6);
        b.connect(bg); bg.connect(this._radioGain);
        b.start(); b.stop(this.ctx.currentTime + beat * 3.8);
      }
      this._step += 1;
      this._timer = setTimeout(tick, beat * 1000);
    };
    tick();
  }
  _blip(freq, dur, type = 'square', vol = 0.25) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this._master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  _noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this._master);
    src.start(); src.stop(this.ctx.currentTime + dur);
  }
  shot() { this._noise(0.12, 0.4, 3000); this._blip(180, 0.08, 'square', 0.2); }
  punch() { this._noise(0.09, 0.3, 500); }
  pickup() { this._blip(660, 0.1); setTimeout(() => this._blip(880, 0.12), 90); }
  cash() { this._blip(880, 0.1); setTimeout(() => this._blip(1174, 0.16), 90); }
  horn() { this._blip(370, 0.25, 'sawtooth', 0.15); }
  siren() { this._blip(720, 0.4, 'sine', 0.08); }
  crash() { this._noise(0.3, 0.45, 800); }
  explosion() { this._noise(0.8, 0.6, 400); }
  jump() { this._blip(440, 0.2, 'sine', 0.2); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._blip(f, 0.18), i * 110)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'sawtooth', 0.2), i * 160)); }
}
