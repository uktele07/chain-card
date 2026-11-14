// 画面は 960x540 の座標で組み、端末の実ピクセルに合わせて拡大率を決める（ぼやけ対策）
export const W = 960, H = 540;
const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
const fit = typeof window === 'undefined' ? 2 : Math.min(window.innerWidth / W, window.innerHeight / H) * dpr;
export const ZOOM = Math.min(4, Math.max(2, Math.ceil(fit)));
