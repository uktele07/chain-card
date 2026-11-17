// 画面まわりの HTML の層（Phaser の Canvas の上に重ねる）。手順は docs/ui-migration.md
// - 状態は GameScene が持つ。ここは毎フレーム読んで描くだけ（lit-html が変わった所だけを DOM に反映する）
// - 入力は受けない（pointer-events: none）。ボタンなどフォーカスを取る部品は置かない
import { html, render, nothing, type TemplateResult } from 'lit-html';
import tokens from './tokens.css?inline';
import base from './ui.css?inline';
import type { GameScene } from '../scenes/GameScene';

/** HTML で描く画面と、その描き方。移し終えた画面をここに足す（GameScene.draw は、ここにある画面を Canvas に描かない） */
export type ViewName = 'list' | 'board' | 'battle' | 'result' | 'menu' | 'equip' | 'deck' | 'shop' | 'confirm' | 'help' | 'reset' | 'pause' | 'resume' | 'dmenu' | 'legend';
export const VIEWS: Partial<Record<ViewName, (gs: GameScene) => TemplateResult>> = {};
export const isHtml = (v: ViewName) => v in VIEWS;

const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('uidebug');
export const UI_DEBUG = debug;
/** 位置合わせの目印の場所（960×540 の座標）。Canvas 側も同じ場所に描く */
export const DEBUG_MARKS: [number, number][] = [[0, 0], [940, 0], [0, 520], [940, 520], [470, 260]];

export class UIRoot {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement | null = null;
  private last = '';

  constructor(parent: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = tokens + base;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'ui';
    parent.appendChild(this.el);
    window.addEventListener('resize', () => requestAnimationFrame(() => this.sync()));
  }

  /** Canvas の大きさと位置を写す。Phaser は Scale.FIT と中央寄せなので、倍率は幅の比で決まる */
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    new ResizeObserver(() => this.sync()).observe(canvas);
    this.sync();
  }

  sync() {
    const c = this.canvas, p = this.el.parentElement;
    if (!c || !p) return;
    const r = c.getBoundingClientRect(), pr = p.getBoundingClientRect();
    const key = `${r.left - pr.left},${r.top - pr.top},${r.width}`;
    if (key === this.last) return;
    this.last = key;
    this.el.style.transform = `translate(${r.left - pr.left}px, ${r.top - pr.top}px) scale(${r.width / 960})`;
  }

  /** 毎フレーム呼ぶ。views は、いま見えている画面のうち HTML で描くもの（奥から順） */
  draw(gs: GameScene, views: ViewName[]) {
    const parts = views.map(v => VIEWS[v]?.(gs) ?? nothing);
    render(html`${parts}${debug ? DEBUG_MARKS.map(([x, y]) => html`<div class="dbg" style="left:${x}px;top:${y}px"></div>`) : nothing}`, this.el);
  }
}
