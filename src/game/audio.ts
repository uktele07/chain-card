// 効果音とBGM。効果音は、録音の素材（public/sfx。CC0）があればそれを鳴らし、無ければその場で合成する。BGM は持ち主が用意した曲（public/audio）を流す。
/** 録音の素材に替えた効果音（2026-11-24、持ち主が聞き比べて選んだ。docs/credits.md）。読み込めないとき（1ファイル版など）は合成の音 */
const SAMPLES = ['hurt', 'hurt-big', 'chain-break', 'refill', 'spell', 'ui-move', 'ui-ok', 'ui-back'] as const;
type SampleName = typeof SAMPLES[number];
const SAMPLE_GAIN = 0.8;   // 素材は loudnorm（-18 LUFS）でそろえてある。合成の音とのつり合い
type Osc = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private seBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  private bgmLevel = 0.35;   // 曲の音量（HTMLAudioElement の volume）
  private seLevel = 0.9;     // 効果音の音量（seBus の gain）
  /** 音量を変える（0〜10 の段階）。BGM は 10 で 0.5、効果音は 10 で 0.9（これまでの音量） */
  setVolume(bgm: number, se: number) {
    this.bgmLevel = BGM_MAX * bgm / 10; this.seLevel = 0.9 * se / 10;
    if (this.ctx) this.seBus.gain.setTargetAtTime(this.seLevel, this.ctx.currentTime, 0.02);
    for (const a of Object.values(this.tracks)) a.volume = this.bgmLevel;
  }

  /** 音を出せる状態か（ブラウザは、クリックやキー操作があるまで音を止めている） */
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  /** 入力のたびに呼ぶ。ブラウザが許可した時点で音が出るようになる */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        this.seBus = this.ctx.createGain(); this.seBus.gain.value = this.seLevel; this.seBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, len);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.loadSamples();
    } catch { /* 音が使えない環境では無音で続ける */ }
  }

  private samples: Partial<Record<SampleName, AudioBuffer>> = {};
  private samplesAsked = false;
  private loadSamples() {
    if (this.samplesAsked || !this.ctx) return;
    this.samplesAsked = true;
    for (const n of SAMPLES) {
      fetch(`sfx/${n}.ogg`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(b => this.ctx!.decodeAudioData(b)).then(buf => { this.samples[n] = buf; }).catch(() => { /* 無ければ合成の音 */ });
    }
  }
  /** 録音の素材を鳴らす。鳴らせたら true（無ければ false で、呼び出し側が合成の音を鳴らす） */
  private sample(n: SampleName, gain = 1): boolean {
    const buf = this.samples[n];
    if (!buf || !this.ready) return false;
    const c = this.ctx!, s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = SAMPLE_GAIN * gain;
    s.connect(g).connect(this.seBus); s.start();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    for (const a of Object.values(this.tracks)) a.muted = this.muted;
  }

  private tone(bus: GainNode, type: Osc, f0: number, f1: number, dur: number, gain: number, at = 0, attack = 0.004) {
    const c = this.ctx!, t = c.currentTime + at + 0.005;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    // 立ち上がり→ゆるく減衰→最後だけ素早く消す（全体を指数で落とすと一瞬で聞こえなくなる）
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(gain * 0.3, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(bus: GainNode, kind: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, at = 0, q = 1) {
    const c = this.ctx!, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = kind; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(gain * 0.25, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** アタック。レベルが上がるほど音が高く、Sは別格の音 */
  hit(lv: number, powered = false) {
    if (!this.ready) return;
    const b = this.seBus;
    if (lv >= 4) {
      this.tone(b, 'sine', 180, 38, 0.55, 0.7);
      this.noise(b, 'lowpass', 6000, 300, 0.45, 0.5);
      for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) this.tone(b, 'sawtooth', f, f, 0.5, 0.11, 0.02 * i);
      this.tone(b, 'square', 1568, 2093, 0.25, 0.08, 0.08);
    } else {
      const f = [0, 523.25, 659.25, 783.99][lv];
      this.tone(b, 'square', f, f * 0.98, 0.13, 0.13);
      this.tone(b, 'triangle', f * 2, f * 2, 0.1, 0.09);
      this.tone(b, 'sine', 150 + lv * 20, 60, 0.12, 0.3);
      this.noise(b, 'highpass', 3000, 3000, 0.05, 0.14);
    }
    if (powered) { this.tone(b, 'triangle', 1318.5, 2637, 0.22, 0.14, 0.03); this.noise(b, 'bandpass', 5000, 9000, 0.2, 0.12, 0.02, 4); }
  }
  spell() {
    if (!this.ready || this.sample('spell')) return;
    for (const [i, f] of [880, 1108.7, 1318.5, 1760].entries()) this.tone(this.seBus, 'sine', f, f, 0.16, 0.13, i * 0.035);
  }
  miss() {
    if (!this.ready) return;
    this.tone(this.seBus, 'sawtooth', 120, 85, 0.2, 0.26);
    this.tone(this.seBus, 'square', 92, 70, 0.2, 0.14);
  }
  skip() { if (this.ready) this.noise(this.seBus, 'bandpass', 2400, 500, 0.22, 0.3, 0, 2); }
  refill() { if (this.ready && !this.sample('refill', 0.7)) { this.noise(this.seBus, 'highpass', 5000, 5000, 0.03, 0.14); this.tone(this.seBus, 'triangle', 1400, 1400, 0.04, 0.07); } }
  keep(on: boolean) { if (this.ready) this.tone(this.seBus, 'triangle', on ? 990 : 660, on ? 1320 : 495, 0.07, 0.15); }
  chainBreak() { if (this.ready && !this.sample('chain-break')) this.tone(this.seBus, 'triangle', 440, 150, 0.32, 0.2); }
  item(effect: string) {
    if (!this.ready) return;
    const b = this.seBus;
    if (effect === 'heal') for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) this.tone(b, 'sine', f, f, 0.3, 0.16, i * 0.07);
    else if (effect === 'flash') { this.noise(b, 'highpass', 800, 6000, 0.35, 0.5); this.tone(b, 'square', 2200, 300, 0.2, 0.12); }
    else for (let i = 0; i < 8; i++) this.tone(b, 'triangle', 700 * 1.122 ** i, 700 * 1.122 ** i, 0.14, 0.1, i * 0.04);
  }
  /** 敵の攻撃を受けた */
  enemyHit(big: boolean) {
    if (!this.ready || this.sample(big ? 'hurt-big' : 'hurt')) return;
    const b = this.seBus;
    this.tone(b, 'sine', big ? 110 : 140, 40, big ? 0.4 : 0.2, big ? 0.8 : 0.5);
    this.noise(b, 'lowpass', big ? 2500 : 1500, 200, big ? 0.35 : 0.16, big ? 0.5 : 0.3);
    if (big) this.tone(b, 'sawtooth', 220, 55, 0.35, 0.2);
  }
  /** 敵が大技を溜め始めた */
  warn() {
    if (!this.ready) return;
    // サイレン: 上がって下がる音を2回
    for (let i = 0; i < 2; i++) {
      this.tone(this.seBus, 'sawtooth', 520, 1040, 0.22, 0.2, i * 0.44);
      this.tone(this.seBus, 'sawtooth', 1040, 520, 0.22, 0.2, i * 0.44 + 0.22);
    }
  }
  /** 大技の直前のカウントダウン。step は残り回数（3→2→1）で、近いほど高い音 */
  warnTick(step: number) {
    if (!this.ready) return;
    const f = [0, 1568, 1174.7, 880][step] ?? 880;
    this.tone(this.seBus, 'square', f, f, 0.11, 0.2);
    this.tone(this.seBus, 'square', f * 2, f * 2, 0.06, 0.08);
  }
  win() {
    if (!this.ready) return;
    for (const [i, f] of [523.25, 659.25, 783.99, 1046.5, 1318.5].entries()) this.tone(this.seBus, 'triangle', f, f, i === 4 ? 0.9 : 0.22, 0.16, i * 0.11);
  }
  lose() {
    if (!this.ready) return;
    for (const [i, f] of [392, 349.23, 311.13, 261.63].entries()) this.tone(this.seBus, 'sawtooth', f, f * 0.97, i === 3 ? 0.9 : 0.3, 0.12, i * 0.22);
  }
  // ---- メニューの操作音 ----
  uiMove() { if (this.ready && !this.sample('ui-move', 0.6)) this.tone(this.seBus, 'triangle', 880, 880, 0.04, 0.09); }
  uiOk() { if (this.ready && !this.sample('ui-ok', 0.7)) { this.tone(this.seBus, 'triangle', 880, 880, 0.06, 0.12); this.tone(this.seBus, 'triangle', 1318.5, 1318.5, 0.09, 0.12, 0.05); } }
  uiBack() { if (this.ready && !this.sample('ui-back', 0.6)) this.tone(this.seBus, 'triangle', 660, 440, 0.09, 0.11); }
  /** 再開前のカウント */
  count() { if (this.ready) this.tone(this.seBus, 'square', 660, 660, 0.1, 0.12); }
  finish() {
    if (!this.ready) return;
    for (const [i, f] of [392, 523.25, 659.25, 783.99].entries()) this.tone(this.seBus, 'triangle', f, f, 0.9, 0.13, i * 0.09);
  }

  // ---- BGM: 持ち主が用意した曲（public/audio）。ループで流す ----
  private tracks: Record<string, HTMLAudioElement> = {};
  private playing: string | null = null;
  private tokens: Record<string, unknown> = {};
  /**
   * 流す曲を毎フレーム伝える。null なら止める（位置は残す）。
   * token が前回と違えば、曲の頭から流す（新しい戦闘、新しい探索）
   */
  music(name: 'dungeon' | 'battle' | null, token?: unknown) {
    if (this.playing && this.playing !== name) { this.tracks[this.playing].pause(); this.playing = null; }
    if (!name || !this.ready) return;
    let a = this.tracks[name];
    if (!a) {
      a = this.tracks[name] = new Audio(`audio/bgm-${name}.mp3`);
      a.loop = true; a.preload = 'auto';
    }
    a.volume = this.bgmLevel; a.muted = this.muted;
    if (this.tokens[name] !== token) { this.tokens[name] = token; try { a.currentTime = 0; } catch { /* 読み込み前 */ } }
    if (this.playing !== name) { this.playing = name; a.play().catch(() => { if (this.playing === name) this.playing = null; }); }
  }
}
/** BGM の最大の音量（曲は平均 -14dB と大きいので、効果音より下げる。初期値 7 で 0.35） */
const BGM_MAX = 0.5;
