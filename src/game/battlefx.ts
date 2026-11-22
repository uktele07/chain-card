// 戦闘背景の演出（Phaser の粒子と光）。見本は docs/samples/fx-sample.html（build-fx-page.mjs）
// 炎の神殿（2026-11-22 決定）: 炎は「光のゆらぎ」（アーチの根元の光がゆっくり脈打ち、ぼんやりした熱気が昇る）と、床から立ちのぼる火の粉。煙は入れない
// 背景と敵のあいだに描く（深さ 1.3。背景の絵は 1、敵の絵は 1.6）
import type Phaser from 'phaser';

/** 背景の絵ごとの、炎を置く場所（960×540 の座標）。背景の絵を替えたら合わせ直す */
export const BG_FLAMES: Record<string, { archY: number; arches: number[] }> = {
  fire: { archY: 300, arches: [84, 239, 398, 558, 717, 876] },
};
const DOT = 'fx-dot';

export class BattleFx {
  private current: string | null = null;
  private want: string | null = null;
  private objs: { stop(): void }[] = [];
  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists(DOT)) {
      const t = scene.textures.createCanvas(DOT, 32, 32)!, x = t.getContext(), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); t.refresh();
    }
  }
  /** このフレームで出す背景を伝える（描く前に null、戦闘の背景を描くときに dungeon）。切り替えは commit で行う */
  set(dungeon: string | null) { this.want = dungeon; }
  /** フレームの最後に呼ぶ。出すものが変わったときだけ、作り直す */
  commit() {
    const dungeon = this.want, id = dungeon && BG_FLAMES[dungeon] ? dungeon : null;
    if (id === this.current) return;
    for (const o of this.objs) o.stop();
    this.objs = []; this.current = id;
    if (!id) return;
    const s = this.scene, f = BG_FLAMES[id];
    // 火の粉: 床から立ちのぼり、ちらつきながら消える
    const ember = s.add.particles(0, 0, DOT, {
      x: { min: 0, max: 960 }, y: { min: 300, max: 560 }, lifespan: { min: 2500, max: 5000 },
      speedY: { min: -55, max: -18 }, speedX: { min: -14, max: 14 }, scale: { start: 0.22, end: 0 },
      alpha: { values: [0, 1, 0.6, 1, 0] }, tint: [0xffb040, 0xff7a2a, 0xffd070], blendMode: 'ADD', frequency: 60, quantity: 1,
    }).setDepth(1.3);
    this.objs.push({ stop: () => ember.destroy() });
    for (const ax of f.arches) {
      // アーチの根元の光が、ゆっくり脈打つ
      const glow = s.add.image(ax, f.archY - 6, DOT).setDisplaySize(130, 70).setTint(0xff6a20).setBlendMode(1).setAlpha(0.2).setDepth(1.3);
      const tw = s.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.32 }, scaleY: { from: glow.scaleY * 0.9, to: glow.scaleY * 1.15 }, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 800 });
      // ぼんやりした熱気が昇る
      const heat = s.add.particles(ax, f.archY, DOT, {
        x: { min: -26, max: 26 }, lifespan: { min: 2200, max: 3200 }, speedY: { min: -18, max: -8 }, scale: { start: 1.4, end: 3.2 },
        alpha: { values: [0, 0.13, 0] }, tint: [0xff7a2a, 0xff9a4a], blendMode: 'ADD', frequency: 320, quantity: 1,
      }).setDepth(1.29);
      this.objs.push({ stop: () => { tw.remove(); glow.destroy(); heat.destroy(); } });
    }
  }
}
