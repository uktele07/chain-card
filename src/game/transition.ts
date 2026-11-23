// 戦闘への切り替わりの演出「墨のにじみ」（2026-11-23、持ち主が4案から選んだ。見本 docs/samples/transition-sample-x1.5.html の A）
// 画面の中央から黒い墨が水彩のようににじんで広がって覆い（覆う）、覆い切ったら裏で戦闘に切り替え、墨が引いて戦闘が現れる（開く）
// 長さは見本の 1.5倍の版（覆う 0.525秒、開く 0.675秒）。HTML の層のさらに上に、960×540 の canvas を重ねて描く
const IN = 0.525, OUT = 0.675;

export class InkTransition {
  private g: CanvasRenderingContext2D;
  private noise: Float32Array;
  private t = 0;
  private phase: 'off' | 'in' | 'out' = 'off';
  private onCovered: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = 1920; canvas.height = 1080;
    Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '960px', height: '540px', pointerEvents: 'none', zIndex: '60' });
    this.g = canvas.getContext('2d')!;
    // にじんだ縁のための、なめらかな値の雑音（96×54）
    const W = 96, H = 54, n = new Float32Array(W * H);
    for (let i = 0; i < n.length; i++) n[i] = Math.random();
    for (let k = 0; k < 3; k++) {
      const m = n.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += m[yy * W + xx]; c++; } }
        n[y * W + x] = s / c;
      }
    }
    let lo = 1, hi = 0; for (const v of n) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < n.length; i++) n[i] = (n[i] - lo) / (hi - lo);
    this.noise = n;
  }
  get active() { return this.phase !== 'off'; }
  /** 覆うところから始める。覆い切ったら onCovered を呼び（ここで戦闘に切り替える）、開く */
  start(onCovered: () => void) { this.phase = 'in'; this.t = 0; this.onCovered = onCovered; }
  /** 決定ボタンで飛ばす: 覆うところなら、すぐに覆い切って開きへ */
  skip() { if (this.phase === 'in') this.t = IN; }
  /** 毎フレーム呼ぶ */
  update(dt: number) {
    if (this.phase === 'off') return;
    this.t += dt;
    if (this.phase === 'in' && this.t >= IN) {
      this.draw(1);
      const f = this.onCovered; this.onCovered = null; f?.();
      this.phase = 'out'; this.t = 0;
      return;
    }
    if (this.phase === 'out' && this.t >= OUT) { this.phase = 'off'; this.g.clearRect(0, 0, 1920, 1080); return; }
    this.draw(this.phase === 'in' ? ease(this.t / IN) : 1 - ease(this.t / OUT));
  }
  /** k: 覆う量（0〜1） */
  private draw(k: number) {
    const g = this.g, cell = 10, R = Math.hypot(480, 270);
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, 960, 540);
    for (let y = 0; y < 540; y += cell) for (let x = 0; x < 960; x += cell) {
      const d = Math.hypot(x - 480, y - 270) / R, n = this.noise[Math.floor(y / 10) * 96 + Math.floor(x / 10)];
      const edge = k * 1.35 - (d * 0.8 + n * 0.45);
      if (edge > 0) { g.fillStyle = `rgba(8,6,5,${Math.min(1, edge * 6)})`; g.fillRect(x, y, cell, cell); }
    }
    // 四角い粒をぼかして、墨のにじみにする
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.filter = 'blur(12px)'; g.drawImage(this.canvas, 0, 0); g.filter = 'none';
  }
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
