// 計算コア(index.html の <script id="core">)の検算。実行: node source/run-checks.js <fixtures dir> [--show-ratios]
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.X=SF;', ctx); const X = ctx.X;
const FIX = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
let n = 0, f = 0;
const J = v => JSON.stringify(v);
const eq = (a, b, m) => { n++; if (J(a) !== J(b)) { f++; console.log('NG', m, J(a), '!=', J(b)); } };
const tr = (c, m) => eq(!!c, true, m);
const base = { ratio: '1:1', pad: 'm', bg: 'lgray', radius: 's', shadow: 'on' };
const L = (iw, ih, o) => X.layout(iw, ih, Object.assign({}, base, o || {}));

// S1 縦長 1170x2532 -> 1:1（1080x1080）。余白 round(1080*0.08)=86、置ける領域 908x908
let a = L(1170, 2532);
eq([a.W, a.H, a.p], [1080, 1080, 86], 'S1 出力寸法と余白');
tr(a.dh <= 908 && a.dw <= 908, 'S1 領域内');
eq(a.dh, 908, 'S1 縦は領域いっぱい');
eq(a.x * 2 + a.dw, 1080, 'S1 左右の余白が等しい'); eq(a.y * 2 + a.dh, 1080, 'S1 上下の余白が等しい');
tr(Number.isInteger(a.x) && Number.isInteger(a.y), 'S1 整数の位置');
tr(!a.up && !a.clamped, 'S1 縮小なので警告なし');
tr(Math.abs(a.dw / a.dh - 1170 / 2532) < 0.003, 'S1 縦横比');
// S2 横長 2560x1440
a = L(2560, 1440, { ratio: '4:5' }); eq([a.W, a.H], [1080, 1350], 'S2 4:5 の出力寸法'); eq(a.x * 2 + a.dw, 1080, 'S2 4:5 左右均等'); eq(a.y * 2 + a.dh, 1350, 'S2 4:5 上下均等'); eq(a.dw, 908, 'S2 4:5 幅いっぱい（余白86）');
a = L(2560, 1440, { ratio: '16:9' }); eq([a.W, a.H], [1920, 1080], 'S2 16:9 の出力寸法'); eq(a.p, 86, 'S2 16:9 余白は短辺基準'); eq(a.dh, 908, 'S2 16:9 縦いっぱい');
eq(L(1000, 1000, { pad: 's' }).p, 43, '余白 小 4% of 1080'); eq(L(1000, 1000, { pad: 'l' }).p, 130, '余白 大 12% of 1080');
eq(L(1000, 1000, { ratio: '16:9', pad: 'l' }).p, 130, '余白は短辺（16:9でも1080基準）');
// S4 小さい画像 480x320 -> 拡大は2倍まで
a = L(480, 320); tr(a.up, 'S4 拡大フラグ'); tr(a.s <= 2.0000001, 'S4 2倍以内'); tr(!a.clamped, 'S4 1:1 では領域で止まる（908/480=1.89）');
a = L(100, 100); eq(a.clamped, true, 'S4 100px は2倍で止める'); eq(a.dw, 200, 'S4 2倍'); tr(a.up, 'S4 拡大フラグ(2倍)');
a = L(908, 908); eq(a.s, 1, '等倍'); tr(!a.up, '等倍は警告なし');
// 角丸: 率と上限
eq(L(1000, 1000, { radius: 'none' }).r, 0, '角丸なし'); eq(L(1000, 1000, { radius: 's' }).r, 16, '角丸小 1080*1.5%=16.2->16'); eq(L(1000, 1000, { radius: 'l' }).r, 43, '角丸大 1080*4%=43.2->43');
eq(L(30, 30, { radius: 'l' }).r <= Math.floor(L(30, 30, { radius: 'l' }).dw / 2), true, '角丸は画像の半分以下');
a = L(1000, 1000, { ratio: '16:9' }); eq(a.blur, 43, '影の ぼかし=短辺4%'); eq(a.offY, 11, '影の 下ずれ=短辺1%');
eq(L(1000, 1000, { shadow: 'off' }).shadow, false, '影なし');
// S8 元の比率
a = L(800, 600, { ratio: 'orig' });
eq([a.dw, a.dh, a.s], [800, 600, 1], 'S8 800x600 は等倍'); eq(a.W, 800 + 2 * a.p, 'S8 幅=画像+余白x2'); eq(a.H, 600 + 2 * a.p, 'S8 高さ');
tr(Math.abs(a.p - Math.min(a.W, a.H) * 0.08) <= 1, 'S8 余白は出力の短辺の8%（誤差1px以内）'); eq(a.x, a.p, 'S8 左の余白'); tr(!a.up, 'S8 拡大なし');
a = L(4000, 3000, { ratio: 'orig' }); eq([a.dw, a.dh], [1600, 1200], 'S8 4000x3000 は長辺1600へ'); tr(a.s < 1, 'S8 縮小'); eq(a.W, 1600 + 2 * a.p, 'S8 縮小後+余白');
a = L(3000, 4000, { ratio: 'orig' }); eq([a.dw, a.dh], [1200, 1600], 'S8 縦長 長辺1600');
for (const pd of ['s', 'm', 'l']) for (const [w, h] of [[800, 600], [1170, 2532], [333, 777], [1600, 1600], [50, 40]]) {
  const b = L(w, h, { ratio: 'orig', pad: pd }); const rate = { s: 0.04, m: 0.08, l: 0.12 }[pd];
  tr(Math.abs(b.p - Math.min(b.W, b.H) * rate) <= 1, `S8 余白率 ${pd} ${w}x${h}`); tr(b.W === b.dw + 2 * b.p && b.H === b.dh + 2 * b.p, `S8 出力=画像+余白x2 ${pd} ${w}x${h}`);
}
for (const r of ['1:1', '4:5', '16:9']) for (const [w, h] of [[1170, 2532], [2560, 1440], [333, 777], [1001, 999], [37, 53], [4096, 4096], [480, 320], [1, 1]]) {
  const b = L(w, h, { ratio: r });
  tr(b.x * 2 + b.dw === b.W && b.y * 2 + b.dh === b.H, `余白均等 ${r} ${w}x${h}`); tr(b.dw >= 1 && b.dh >= 1 && b.dw <= b.W && b.dh <= b.H, `領域内 ${r} ${w}x${h}`);
  tr(b.s <= 2.0000001 || b.dw <= 2, `拡大上限 ${r} ${w}x${h}`);
}
// 極端に細い画像でも余白0・半ピクセルにならない
a = L(202, 10, { ratio: 'orig' }); tr(a.p >= 1, '細い画像 元の比率でも余白1px以上'); a = L(2191, 4); tr(Number.isInteger(a.x) && Number.isInteger(a.y) && a.x * 2 + a.dw === a.W && a.y * 2 + a.dh === a.H, '細い画像 位置が整数・余白均等 ' + J(a));
a = L(4, 2191); tr(Number.isInteger(a.x) && Number.isInteger(a.y), '細い画像(縦) 位置が整数');
// 背景・選択肢
eq(X.BGS.length, 10, '背景は10種'); eq(X.BGS.filter(b => b.c.length === 1).length, 6, '単色6種'); eq(X.BGS.filter(b => b.c.length === 2).length, 4, 'グラデーション4種');
eq(X.BGS.filter(b => b.c.length === 1).map(b => b.c[0]), ['#FFFFFF', '#F2F2F2', '#2A2A2A', '#111111', '#F5EFE6', '#E8EEF5'], '単色の値');
eq(X.DEFAULTS, { ratio: '1:1', pad: 'm', bg: 'lgray', radius: 's', shadow: 'on' }, '初期値（中・薄灰・角丸小・影あり）');
eq(X.RATIOS.map(r => r.id), ['1:1', '4:5', '16:9', 'orig'], '比率の選択肢');
eq(X.BGS.slice(6).map(b => b.label), ['朝焼け', '海', '森', '墨'], 'グラデーション名');
// ファイル名
eq(X.fileName('1:1', new Date(2026, 9, 12, 8, 5, 9)), 'framed-1x1-20261012-080509.png', 'ファイル名 1:1');
eq(X.fileName('4:5', new Date(2026, 0, 2, 13, 14, 15)), 'framed-4x5-20260102-131415.png', 'ファイル名 4:5'); eq(X.fileName('16:9', new Date(2026, 11, 31, 23, 59, 59)), 'framed-16x9-20261231-235959.png', 'ファイル名 16:9'); eq(X.fileName('orig', new Date(2026, 9, 12, 0, 0, 0)), 'framed-orig-20261012-000000.png', 'ファイル名 元の比率');
// S10 UA分岐（実在のUA文字列）
const UA = {
  iphoneSafari: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'iPhone', 5],
  iosChrome: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1', 'iPhone', 5],
  ipadDesktopUA: ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'MacIntel', 5],
  ipadMobileUA: ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'iPad', 5],
  androidChrome: ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'Linux armv81', 5],
  winChrome: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Win32', 0],
  macSafari: ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'MacIntel', 0],
  macOneTouch: ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'MacIntel', 1]
};
const want = { iphoneSafari: 'share', iosChrome: 'share', ipadDesktopUA: 'share', ipadMobileUA: 'share', androidChrome: 'download', winChrome: 'download', macSafari: 'download', macOneTouch: 'download' };
for (const k of Object.keys(UA)) eq(X.saveRoute(...UA[k]), want[k], 'S10 保存経路 ' + k);
eq(X.saveRoute('', '', 0), 'download', 'S10 空のUA'); eq(X.saveRoute(undefined, undefined, undefined), 'download', 'S10 未定義');
// sniff（先頭バイトで判定）
if (FIX) {
  const head = name => new Uint8Array(fs.readFileSync(path.join(FIX, name)).subarray(0, 32));
  const K = { 's1-tall-1170x2532.png': 'png', 's2-wide-2560x1440.jpg': 'jpeg', 's6-orient6.jpg': 'jpeg', 's12-webp-900x500.webp': 'webp', 's3-transparent.png': 'png',
    's7-note.txt': 'text', 's7-doc.pdf': 'pdf', 's7-photo.heic': 'heic', 's7-anim.gif': 'gif', 's7-vector.svg': 'svg', 's7-corrupt.png': 'png', 's9-over20mb.png': 'png' };
  for (const k of Object.keys(K)) eq(X.sniff(head(k)), K[k], 'sniff ' + k);
  eq(X.classify('png'), 'ok', 'png は読める'); eq(X.classify('webp'), 'ok', 'webp'); eq(X.classify('heic'), 'unsupported', 'S7 HEIC は読めない形式'); eq(X.classify('gif'), 'unsupported', 'GIF'); eq(X.classify('text'), 'notimage', 'S7 txt は画像ではない'); eq(X.classify('pdf'), 'notimage', 'S7 pdf は画像ではない'); eq(X.classify('unknown'), 'notimage', '不明');
}
if (FIX) {
  const full = name => new Uint8Array(fs.readFileSync(path.join(FIX, name)).subarray(0, 262144));
  const SZ = [['s1-tall-1170x2532.png', 'png', 1170, 2532], ['s2-wide-2560x1440.jpg', 'jpeg', 2560, 1440], ['s6-orient6.jpg', 'jpeg', 400, 200], ['s12-webp-900x500.webp', 'webp', 900, 500], ['s5-huge-8000x6000.png', 'png', 8000, 6000], ['s13-claim-20000x20000.png', 'png', 20000, 20000], ['s14-bigexif-640x480.jpg', 'jpeg', 640, 480], ['s8-4000x3000.png', 'png', 4000, 3000]];
  for (const [nm, k, w, h] of SZ) { const z = X.imageSize(full(nm), k); eq(z && [z.w, z.h], [w, h], 'imageSize ' + nm); }
  tr(full('s13-claim-20000x20000.png').length < 200, 's13は小さなファイル（寸法の主張だけ）');
  const z13 = X.imageSize(full('s13-claim-20000x20000.png'), 'png'); tr(z13.w * z13.h > X.MAX_PIXELS, 's13は上限(1億px)を超える');
  tr(X.imageSize(full('s5-huge-8000x6000.png'), 'png').w * 6000 <= X.MAX_PIXELS, '8000x6000は上限内（4800万px）');
  eq(X.imageSize(new Uint8Array(10), 'png'), null, 'imageSize 短すぎる');
}
eq(X.sniff(new Uint8Array([])), 'unknown', '空'); eq(X.sniff(new Uint8Array([0x42, 0x4D, 0x41, 0x42])), 'text', '"BMAB" は画像にしない（BMP判定を厳しく）');
eq(X.sniff(new Uint8Array([0xEF, 0xBB, 0xBF, 0x3C, 0x73, 0x76, 0x67, 0x20, 0x78])), 'svg', 'BOM付きSVG');
eq(X.sniff(new Uint8Array([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])), 'avif', 'AVIF');
eq(X.sniff(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32])), 'video', 'mp4 は画像ではない'); eq(X.classify('video'), 'notimage', 'mp4');
eq([X.MAX_SIDE, X.MAX_BYTES, X.MAX_UP], [4096, 20 * 1024 * 1024, 2], '上限値');

// ---- 配色のコントラスト比（WCAG） ----
function lum(h) { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
function vars(block) { const o = {}; block.replace(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g, (m, k, v) => { o[k] = v; return m; }); return o; }
const light = vars(css.match(/:root \{([\s\S]*?)\}/)[1]);
const dark = Object.assign({}, light, vars(css.match(/prefers-color-scheme: dark\) \{([\s\S]*?)\n  \}/)[1]));
const ratios = {};
for (const [nm, v] of [['light', light], ['dark', dark]]) {
  const pairs = [['ink', 'bg'], ['ink', 'surface'], ['ink2', 'surface'], ['ink3', 'surface'], ['ink3', 'bg'], ['accent', 'surface'], ['accent', 'bg'], ['accent', 'accent-soft'], ['accent-ink', 'accent'], ['warn-ink', 'warn-bg'], ['danger', 'bg'], ['danger', 'surface'], ['ok', 'bg'], ['ok', 'surface'], ['ink', 'accent-soft']];
  for (const [fg, bgc] of pairs) { const r = cr(v[fg], v[bgc]); ratios[nm + ' ' + fg + '/' + bgc] = Math.round(r * 100) / 100; tr(r >= 4.5, `コントラスト ${nm} ${fg}/${bgc} = ${r.toFixed(2)}`); }
  tr(cr(v['line-strong'], v['surface']) >= 3, `枠線 ${nm} line-strong/surface >= 3 (${cr(v['line-strong'], v['surface']).toFixed(2)})`);
}
if (process.argv.includes('--show-ratios')) console.log(ratios);
eq(light.accent, '#1A6B6E', '鉄色(ライト)'); eq(dark.accent, '#86D0D2', '鉄色(ダーク)');

// ---- HTML の静的検査 ----
const uiSrc = html.match(/<script id="ui">([\s\S]*?)<\/script>/)[1];
tr(/class="mw-footer"/.test(html) && /みちAIワークス/.test(html) && /nncf123nncf@gmail\.com/.test(html), '素性表記フッタ');
tr(!/href="#"/.test(html), 'href="#" なし');
tr(!/(bit\.ly|forms\.gle|lin\.ee|t\.co\/|tinyurl|goo\.gl)/.test(html), '短縮URLなし');
tr(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(html), '保存APIを使っていない');
tr(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write|eval\(/.test(html), 'innerHTML等を使っていない');
tr(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(html), '自前の通信なし');
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '') + ' ' + uiSrc;
for (const w of ['バズ', '伸びる', '伸びます', '映える', 'プロ級', '推奨サイズ', 'SNS推奨', '最適化', '安全', '確実', '必ず', '人工知能']) tr(!visible.includes(w), '禁止語 ' + w);
tr(!/AI/.test(visible.replace(/みちAIワークス（MICHI AI WORKS）/g, '').replace(/みちAIワークス/g, '')), '「AI」と名乗っていない（屋号を除く）');
tr(/ぼやけることがあります/.test(html) && /隠せません/.test(html) && /保存もしません/.test(html) && /PNGです/.test(html), '常設の注意3行とぼやけの文言');
tr(/<input id="file" class="vh" type="file">/.test(html) && !/accept=/.test(html), 'accept属性なし');
tr(/toDataURL\('image\/png'\)/.test(html) && !/\.toBlob\(/.test(html), 'toDataURLで書き出し（toBlobは使わない）');
tr(/createImageBitmap\(file, \{ imageOrientation: 'from-image' \}\)/.test(html), 'createImageBitmap(from-image)');
tr(/static\.cloudflareinsights\.com\/beacon\.min\.js/.test(html) && /b4c9f7e78daf4edb84ef52b88633f649/.test(html), '計測ビーコン(他Dayと同じ)');

console.log(`${n - f}/${n} 通過` + (f ? `、失敗 ${f}` : ''));
process.exit(f ? 1 : 0);
