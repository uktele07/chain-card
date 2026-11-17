import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { W, H, ZOOM } from './game/display';

// 画面まわりの書体を先に読む（読む前に描くと文字の幅が変わって一瞬崩れる）。1ファイル版は書体を入れない。
// 遅い回線でも始められるように、待つのは最大 2.5秒
async function loadFonts() {
  if (__SINGLE__) return;
  try {
    await import('./views/fonts');
    const wanted = ['500 16px "Noto Sans JP"', '400 16px "Noto Sans JP"', '16px "Dela Gothic One"', '300 16px "Inter Variable"'];
    await Promise.race([
      Promise.all(wanted.map(f => document.fonts.load(f, 'あア亜Aa0'))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch { /* 書体が読めなくても、代わりの書体で動かす */ }
}

loadFonts().then(() => new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W * ZOOM,
  height: H * ZOOM,
  backgroundColor: '#0d1017',
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
}));
