// 効果音とBGM。素材ファイルを使わず、その場で音を合成する。
type Osc = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private seBus!: GainNode;
  private bgmBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  private bgmOn = false;
  private nextStep = 0;
  private step = 0;
  /** BGMの厚み（チェインの段数 0〜4）。上がるほど音が増える */
  intensity = 0;

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
        this.seBus = this.ctx.createGain(); this.seBus.gain.value = 0.9; this.seBus.connect(this.master);
        this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = 0.26; this.bgmBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, len);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* 音が使えない環境では無音で続ける */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
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
    if (!this.ready) return;
    for (const [i, f] of [880, 1108.7, 1318.5, 1760].entries()) this.tone(this.seBus, 'sine', f, f, 0.16, 0.13, i * 0.035);
  }
  miss() {
    if (!this.ready) return;
    this.tone(this.seBus, 'sawtooth', 120, 85, 0.2, 0.26);
    this.tone(this.seBus, 'square', 92, 70, 0.2, 0.14);
  }
  skip() { if (this.ready) this.noise(this.seBus, 'bandpass', 2400, 500, 0.22, 0.3, 0, 2); }
  refill() { if (this.ready) { this.noise(this.seBus, 'highpass', 5000, 5000, 0.03, 0.14); this.tone(this.seBus, 'triangle', 1400, 1400, 0.04, 0.07); } }
  keep(on: boolean) { if (this.ready) this.tone(this.seBus, 'triangle', on ? 990 : 660, on ? 1320 : 495, 0.07, 0.15); }
  chainBreak() { if (this.ready) this.tone(this.seBus, 'triangle', 440, 150, 0.32, 0.2); }
  item(effect: string) {
    if (!this.ready) return;
    const b = this.seBus;
    if (effect === 'heal') for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) this.tone(b, 'sine', f, f, 0.3, 0.16, i * 0.07);
    else if (effect === 'flash') { this.noise(b, 'highpass', 800, 6000, 0.35, 0.5); this.tone(b, 'square', 2200, 300, 0.2, 0.12); }
    else for (let i = 0; i < 8; i++) this.tone(b, 'triangle', 700 * 1.122 ** i, 700 * 1.122 ** i, 0.14, 0.1, i * 0.04);
  }
  /** 敵の攻撃を受けた */
  enemyHit(big: boolean) {
    if (!this.ready) return;
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
  uiMove() { if (this.ready) this.tone(this.seBus, 'triangle', 880, 880, 0.04, 0.09); }
  uiOk() { if (this.ready) { this.tone(this.seBus, 'triangle', 880, 880, 0.06, 0.12); this.tone(this.seBus, 'triangle', 1318.5, 1318.5, 0.09, 0.12, 0.05); } }
  uiBack() { if (this.ready) this.tone(this.seBus, 'triangle', 660, 440, 0.09, 0.11); }
  /** 再開前のカウント */
  count() { if (this.ready) this.tone(this.seBus, 'square', 660, 660, 0.1, 0.12); }
  finish() {
    if (!this.ready) return;
    for (const [i, f] of [392, 523.25, 659.25, 783.99].entries()) this.tone(this.seBus, 'triangle', f, f, 0.9, 0.13, i * 0.09);
  }

  // ---- BGM: 16分音符を刻んで先回りで予約する ----
  startBgm() { if (!this.ctx) return; this.bgmOn = true; this.step = 0; this.nextStep = this.ctx.currentTime + 0.05; }
  stopBgm() { this.bgmOn = false; }

  /** 毎フレーム呼ぶ */
  update() {
    if (!this.bgmOn || !this.ready) return;
    const c = this.ctx!, spb = 60 / 138 / 4;
    if (this.nextStep < c.currentTime - 0.2) this.nextStep = c.currentTime + 0.02;   // タブが止まっていた場合
    while (this.nextStep < c.currentTime + 0.12) {
      this.schedule(this.step, this.nextStep - c.currentTime);
      this.nextStep += spb; this.step++;
    }
  }

  private schedule(step: number, at: number) {
    const b = this.bgmBus, s = step % 16, bar = Math.floor(step / 16) % 4;
    const root = [110, 87.31, 130.81, 98][bar];                       // Am F C G
    const chord = [[1, 1.189, 1.498], [1, 1.26, 1.498], [1, 1.26, 1.498], [1, 1.26, 1.498]][bar];
    if (s % 4 === 0) this.tone(b, 'sine', 150, 42, 0.16, 0.95, at, 0.002);                                    // キック
    if (s % 4 === 2) this.noise(b, 'highpass', 7000, 7000, 0.035, this.intensity >= 1 ? 0.2 : 0.1, at);       // ハット
    if (this.intensity >= 2 && s % 8 === 4) this.noise(b, 'bandpass', 1800, 1800, 0.11, 0.38, at, 0.8);       // スネア
    if (s % 2 === 0) this.tone(b, 'sawtooth', root * (s % 8 === 6 ? 2 : 1), root * (s % 8 === 6 ? 2 : 1), 0.11, 0.2, at); // ベース
    if (this.intensity >= 1) {                                                                                // アルペジオ
      const n = chord[[0, 1, 2, 1][s % 4]] * root * 4 * (s >= 8 && this.intensity >= 3 ? 2 : 1);
      this.tone(b, 'square', n, n, 0.09, this.intensity >= 3 ? 0.085 : 0.06, at);
    }
    if (this.intensity >= 4 && s % 2 === 0) { const n = chord[(s / 2) % 3] * root * 8; this.tone(b, 'triangle', n, n, 0.2, 0.11, at); } // S中の上物
  }
}
