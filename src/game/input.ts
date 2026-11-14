// キーボードとゲームパッドを「押した瞬間」のボタンにまとめる。
// 画面ごとの意味づけ（カードを出す / カーソルを動かす など）は、受け取る側で行う。
export type Btn =
  | 'tri' | 'circle' | 'cross' | 'square'      // △ ○ ✕ □
  | 'up' | 'right' | 'down' | 'left'           // 十字キー
  | 'skip' | 'l2' | 'r2' | 'options' | 'touchpad'
  | 'ok' | 'back' | 'mute';                    // キーボード専用: Enter / Backspace / M

const KEYS: Record<string, Btn> = {
  KeyW: 'tri', KeyD: 'circle', KeyS: 'cross', KeyA: 'square',
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  Space: 'skip', KeyQ: 'l2', KeyE: 'r2', Escape: 'options', KeyT: 'touchpad',
  Enter: 'ok', Backspace: 'back', KeyM: 'mute',
};
// 標準配置のゲームパッド
const PAD: Record<number, Btn> = {
  3: 'tri', 1: 'circle', 0: 'cross', 2: 'square',
  12: 'up', 15: 'right', 13: 'down', 14: 'left',
  5: 'skip', 4: 'skip', 6: 'l2', 7: 'r2', 9: 'options', 17: 'touchpad',
};

export class Input {
  private queue: Btn[] = [];
  private padDown = new Set<number>();
  padConnected = false;
  /** ok=使用中 / none=未検出 / blocked=このページでは使えない / nonstandard=ボタン配置が標準でない */
  padStatus: 'ok' | 'none' | 'blocked' | 'nonstandard' = 'none';

  constructor() {
    window.addEventListener('keydown', e => {
      const b = KEYS[e.code];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) this.queue.push(b);
    });
  }

  /** 毎フレーム呼ぶ。前回から新しく押されたボタンを返す */
  poll(): Btn[] {
    let pads: (Gamepad | null)[] = [];
    let blocked = !navigator.getGamepads;
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { blocked = true; /* 埋め込み先で禁止されている場合 */ }
    const policy = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy;
    try { if (policy && !policy.allowsFeature('gamepad')) blocked = true; } catch { /* 判定できない環境 */ }
    const pad = pads.find(p => p && p.connected) ?? null;
    this.padConnected = !!pad;
    this.padStatus = pad ? (pad.mapping === 'standard' ? 'ok' : 'nonstandard') : blocked ? 'blocked' : 'none';
    if (pad) {
      for (const key of Object.keys(PAD)) {
        const i = Number(key);
        const down = !!pad.buttons[i]?.pressed;
        if (down && !this.padDown.has(i)) this.queue.push(PAD[i]);
        if (down) this.padDown.add(i); else this.padDown.delete(i);
      }
    }
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
