// 投稿カード用の実画面を撮る(Chrome headless / CDP)。元の画像は prep-images.js が作ったもの（公開済みDay065の実画面・架空の小さな注文画面）。
// 実行: node source/shoot.js <元画像のフォルダ> <出力フォルダ> [YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { launch } = require('./cdp');
const SRC = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]); const DATE = process.argv[4] || '2026-10-12';
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await launch(9375);
  const opt = (k, v) => b.ev(`document.querySelector('.chip[data-key="${k}"][data-id="${v}"]').click()`);
  const rect = sel => b.ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right}})()`);
  // Card1: デスクトップ1000px・2カラム。左に元の画像（公開済みDay065の実画面）、右に整えた結果（1:1・余白中・海・角丸小・影あり）
  await b.open(PAGE, 900, 900, 2, false);
  await b.pick('#file', path.join(SRC, 'day065-sample-375.png'));
  for (const [k, v] of [['ratio', '1:1'], ['pad', 'm'], ['bg', 'umi'], ['radius', 's'], ['shadow', 'on']]) await opt(k, v);
  await b.sleep(300);
  const lay = await rect('.layout'), h1 = await rect('h1'), res = await rect('.col-out .panel'), src = await rect('#srcSec'), opts = await rect('#opts');
  console.log('card1', JSON.stringify({ lay, h1, res, src, opts }));
  await b.shot(path.join(OUT, '01-desktop-result-' + DATE + '.png'), { x: 0, y: Math.max(0, lay.top - 16), width: 900, height: src.bottom + 8 - (lay.top - 16) });
  await b.shot(path.join(OUT, 'source-desktop-full.png'), { x: 0, y: 0, width: 900, height: await b.ev('document.documentElement.scrollHeight') });
  // Card2: 375px・DPR2。小さい画像（480x320）を16:9・濃灰・角丸大で整えた状態（拡大は2倍で止まる）。ぼやけの補足まで（見出しが2行になるため、保存ボタンは画角に入れない）。
  // （4:5にすると結果の画像だけで高さが約400pxになり、補足と保存ボタンまで入れると占有率の下限60%を満たせない。iPhone向けの保存案内も同様に画角へ入れない。16:9にして収める）
  await b.open(PAGE, 375, 900, 2, true);
  await b.pick('#file', path.join(SRC, 'small-480x320.png'));
  for (const [k, v] of [['ratio', '16:9'], ['pad', 'm'], ['bg', 'dgray'], ['radius', 'l'], ['shadow', 'on']]) await opt(k, v);
  await b.sleep(300);
  const warn = await rect('#blurWarn'), save = await rect('#saveBtn'), outc = await rect('#out');
  console.log('card2', JSON.stringify({ warn, save, outc }));
  await b.shot(path.join(OUT, '02-mobile375-result-' + DATE + '.png'), { x: 0, y: outc.top - 8, width: 375, height: warn.bottom - outc.top + 18 });
  await b.shot(path.join(OUT, 'source-mobile375-full.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });
