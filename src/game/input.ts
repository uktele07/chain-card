// キーボードとゲームパッドを「押した瞬間」のアクションにまとめる。
// スロットの並び: 0=△(上) 1=○(右) 2=✕(下) 3=□(左)
export type Action =
  | { kind: 'card'; slot: number }
  | { kind: 'keep'; slot: number }
  | { kind: 'item'; slot: number }
  | { kind: 'skip' }
  | { kind: 'mute' }
  | { kind: 'invincible' }
  | { kind: 'restart' };

const KEYS: Record<string, Action> = {
  KeyW: { kind: 'card', slot: 0 }, KeyD: { kind: 'card', slot: 1 }, KeyS: { kind: 'card', slot: 2 }, KeyA: { kind: 'card', slot: 3 },
  ArrowUp: { kind: 'keep', slot: 0 }, ArrowRight: { kind: 'keep', slot: 1 }, ArrowDown: { kind: 'keep', slot: 2 }, ArrowLeft: { kind: 'keep', slot: 3 },
  KeyQ: { kind: 'item', slot: 0 }, KeyE: { kind: 'item', slot: 1 },
  Space: { kind: 'skip' }, KeyR: { kind: 'restart' }, KeyM: { kind: 'mute' }, KeyT: { kind: 'invincible' },
};
// 標準配置のゲームパッド
const PAD: Record<number, Action> = {
  3: { kind: 'card', slot: 0 }, 1: { kind: 'card', slot: 1 }, 0: { kind: 'card', slot: 2 }, 2: { kind: 'card', slot: 3 },
  12: { kind: 'keep', slot: 0 }, 15: { kind: 'keep', slot: 1 }, 13: { kind: 'keep', slot: 2 }, 14: { kind: 'keep', slot: 3 },
  6: { kind: 'item', slot: 0 }, 7: { kind: 'item', slot: 1 },
  5: { kind: 'skip' }, 4: { kind: 'skip' }, 9: { kind: 'restart' },
  17: { kind: 'invincible' },   // タッチパッド押し込み（テスト用の無敵切り替え）
};

export class Input {
  private queue: Action[] = [];
  private padDown = new Set<number>();
  padConnected = false;
  /** ok=使用中 / none=未検出 / blocked=このページでは使えない / nonstandard=ボタン配置が標準でない */
  padStatus: 'ok' | 'none' | 'blocked' | 'nonstandard' = 'none';
  padName = '';

  constructor() {
    window.addEventListener('keydown', e => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.queue.push(a);
    });
  }

  /** タッチやクリックからのアクションを積む */
  push(a: Action) { this.queue.push(a); }

  /** 毎フレーム呼ぶ。前回から新しく押されたアクションを返す */
  poll(): Action[] {
    let pads: (Gamepad | null)[] = [];
    let blocked = !navigator.getGamepads;
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { blocked = true; /* 埋め込み先で禁止されている場合 */ }
    const policy = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy;
    try { if (policy && !policy.allowsFeature('gamepad')) blocked = true; } catch { /* 判定できない環境 */ }
    const pad = pads.find(p => p && p.connected) ?? null;
    this.padConnected = !!pad;
    this.padName = pad?.id ?? '';
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
