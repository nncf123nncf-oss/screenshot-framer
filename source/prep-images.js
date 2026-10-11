// 投稿カードの「元の画像」を用意する。実行: node source/prep-images.js <出力フォルダ>
//  1) day065-sample-375.png … 公開済みの Day065「入金チェック」の実画面（架空サンプルで照合した直後）を 375px・DPR2 で撮った画面部分だけ
//  2) small-480x320.png      … 小さい画像の例。架空の注文通知の画面を 480x320 で描いたもの（実在の店・人ではない）
// 作業中のブラウザ全体（タブ・ブックマーク）は使わない。ページ内だけを撮る。
const path = require('path'), fs = require('fs');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2]); fs.mkdirSync(OUT, { recursive: true });
const LIVE = 'https://nncf123nncf-oss.github.io/unpaid-invoice-checker/';
(async () => {
  const b = await launch(9374);
  await b.open(LIVE, 375, 900, 2, true);
  await b.ev('document.getElementById("sample").click()'); await b.sleep(500);
  // 画面部分: 合計の帯（期日超過・期日前…）から、期日超過の2件の下まで
  const r = JSON.parse(await b.ev(`JSON.stringify({top:document.getElementById('band').getBoundingClientRect().top+scrollY,bottom:document.getElementById('lOver').getBoundingClientRect().bottom+scrollY,h1:document.querySelector('h1').getBoundingClientRect().top+scrollY})`));
  console.log('region', r);
  await b.shot(path.join(OUT, 'day065-sample-375.png'), { x: 0, y: r.top - 12, width: 375, height: r.bottom - r.top + 24 });
  await b.shot(path.join(OUT, 'day065-full-375.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  // 小さい画像の例（480x320）
  const html = `<!doctype html><meta charset=utf-8><body style="margin:0;width:480px;height:320px;overflow:hidden;background:#f6f1e8;will-change:transform;font-family:'Yu Gothic','Hiragino Sans',system-ui,sans-serif;color:#2a2a2a">
  <div style="will-change:transform;background:#2d4a3e;color:#fff;padding:14px 18px;font-weight:700;font-size:22px">みなと堂　ご注文</div>
  <div style="padding:16px 18px">
    <div style="font-size:15px;color:#6a6a6a">受付 10/12 9:41（架空のサンプル）</div>
    <div style="margin-top:10px;background:#fff;border-radius:10px;padding:12px 14px;font-size:19px;line-height:1.7">
      <div style="display:flex;justify-content:space-between"><span>ドリップコーヒー豆</span><b>2点</b></div>
      <div style="display:flex;justify-content:space-between"><span>焼き菓子セット</span><b>1点</b></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;margin-top:6px;padding-top:6px"><span>合計</span><b>¥5,280</b></div>
    </div>
    <div style="margin-top:14px;display:inline-block;background:#2d4a3e;color:#fff;border-radius:8px;padding:8px 22px;font-size:18px;font-weight:700">発送の準備をする</div>
  </div></body>`;
  await b.open('data:text/html;charset=utf-8,' + encodeURIComponent(html), 480, 320, 1, false);
  await b.shot(path.join(OUT, 'small-480x320.png'), { x: 0, y: 0, width: 480, height: 320 });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });
