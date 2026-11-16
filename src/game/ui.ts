// 毎フレーム描き直す方式の描画の土台。図形・絵・文字を「層」ごとに持ち、上の層が下の層を必ず覆う。
import Phaser from 'phaser';
import { ZOOM } from './display';

export const FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "IPAGothic", sans-serif';
export type Anchor = 'start' | 'middle' | 'end';
const hex = (c: string) => parseInt(c.slice(1), 16);

export class Layer {
  readonly g: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private sigs: string[] = [];
  private ti = 0;
  private imgs: Phaser.GameObjects.Image[] = [];
  private ii = 0;

  constructor(private scene: Phaser.Scene, private depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  begin() { this.g.clear(); this.ti = 0; this.ii = 0; }
  end() {
    for (let i = this.ti; i < this.texts.length; i++) this.texts[i].setVisible(false);
    for (let i = this.ii; i < this.imgs.length; i++) this.imgs[i].setVisible(false);
  }

  text(x: number, y: number, s: string | number, size = 14, color = '#e6e9ef', anchor: Anchor = 'middle', bold = false, alpha = 1) {
    let t = this.texts[this.ti];
    if (!t) {
      t = this.scene.add.text(0, 0, '', { fontFamily: FONT }).setDepth(this.depth + 2).setResolution(ZOOM);
      this.texts.push(t); this.sigs.push('');
    }
    const str = String(s), sig = `${size}|${color}|${bold}|${anchor}|${str}`;
    if (this.sigs[this.ti] !== sig) {
      this.sigs[this.ti] = sig;
      t.setStyle({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', align: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center' });
      t.setText(str);
      t.setOrigin(anchor === 'start' ? 0 : anchor === 'end' ? 1 : 0.5, 0.5);
    }
    t.setPosition(x, y).setAlpha(alpha).setVisible(true).setScale(1);
    this.ti++;
    return t;
  }

  /** 絵を中心 (x, y) に置く。h を省くと正方形 */
  image(key: string, x: number, y: number, size: number, alpha = 1, tint?: number, h = size) {
    if (!this.scene.textures.exists(key)) return;
    let im = this.imgs[this.ii];
    if (!im) { im = this.scene.add.image(0, 0, key).setDepth(this.depth + 1); this.imgs.push(im); }
    if (im.texture.key !== key) im.setTexture(key);
    im.setPosition(x, y).setDisplaySize(size, h).setAlpha(alpha).setVisible(true);
    if (tint === undefined) im.clearTint(); else im.setTint(tint);
    this.ii++;
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; sw?: number; rx?: number; alpha?: number } = {}) {
    const { fill, stroke, sw = 2, rx = 0, alpha = 1 } = o;
    if (w <= 0 || h <= 0) return;
    const r = Math.min(rx, w / 2, h / 2);
    if (fill) { this.g.fillStyle(hex(fill), alpha); if (r > 0) this.g.fillRoundedRect(x, y, w, h, r); else this.g.fillRect(x, y, w, h); }
    if (stroke) { this.g.lineStyle(sw, hex(stroke), fill ? 1 : alpha); if (r > 0) this.g.strokeRoundedRect(x, y, w, h, r); else this.g.strokeRect(x, y, w, h); }
  }
  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; sw?: number; alpha?: number } = {}) {
    const { fill, stroke, sw = 2, alpha = 1 } = o;
    if (fill) this.g.fillStyle(hex(fill), alpha).fillCircle(x, y, r);
    if (stroke) this.g.lineStyle(sw, hex(stroke), fill ? 1 : alpha).strokeCircle(x, y, r);
  }
  /** 12時の位置から時計回りに、割合 ratio ぶんの弧 */
  arc(x: number, y: number, r: number, ratio: number, color: string, sw: number) {
    if (ratio <= 0) return;
    this.g.lineStyle(sw, hex(color));
    this.g.beginPath();
    this.g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio), false);
    this.g.strokePath();
  }
  /** (x, y) を中心に、angle（ラジアン。0で右向き）を向いた三角 */
  tri(x: number, y: number, size: number, angle: number, fill: string, alpha = 1) {
    const p = (a: number, r: number) => [x + Math.cos(angle + a) * r, y + Math.sin(angle + a) * r];
    const [ax, ay] = p(0, size), [bx, by] = p(2.4, size * 0.9), [cx, cy] = p(-2.4, size * 0.9);
    this.g.fillStyle(hex(fill), alpha).fillTriangle(ax, ay, bx, by, cx, cy);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, sw = 1.5) {
    this.g.lineStyle(sw, hex(color)).lineBetween(x1, y1, x2, y2);
  }
  ellipse(x: number, y: number, w: number, h: number, fill: string, alpha = 1) {
    this.g.fillStyle(hex(fill), alpha).fillEllipse(x, y, w, h);
  }
}
