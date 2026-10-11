// 実ブラウザ(Chrome headless / CDP)での検算。実行: node source/e2e.js <fixtures dir> <出力PNGの保存先>
// 出力PNGは source/check-output.py がPillowで数値確認する（S12）
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os'), crypto = require('crypto');
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const FIX = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('NG', m); } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-e2e-'));
const fx = n => path.join(FIX, n);
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
(async () => {
  const chrome = cp.spawn(CHROME, ['--headless=new', '--remote-debugging-port=9373', '--user-data-dir=' + path.join(TMP, 'prof'), '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let t; for (let i = 0; i < 50; i++) { try { t = await getJson('http://127.0.0.1:9373/json'); if (t.length) break; } catch (e) { } await sleep(200); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = {}; const errs = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } if (m.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300)); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async x => { const r = (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result; if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  // 通信・保存・ダウンロード・共有の監視
  const HOOK = `window.__net=[];const of=window.fetch;window.fetch=function(){window.__net.push('fetch:'+arguments[0]);return of.apply(this,arguments)};
    const ox=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){window.__net.push('xhr:'+arguments[1]);return ox.apply(this,arguments)};
    navigator.sendBeacon=function(){window.__net.push('beacon:'+arguments[0]);return true};
    window.__ls=[];const sset=Storage.prototype.setItem;Storage.prototype.setItem=function(){window.__ls.push(arguments[0]);return sset.apply(this,arguments)};
    try{indexedDB.open=function(){window.__ls.push('idb');throw new Error('x')}}catch(e){}
    window.__xss=0;window.alert=function(){window.__xss++};
    window.__dl=[];const oc=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){const h=this.href,d=this.download;if(d){of.call(window,h).then(r=>r.arrayBuffer()).then(b=>{const u=new Uint8Array(b);window.__dl.push({download:d,size:b.byteLength,sig:Array.from(u.slice(0,8)).join(',')})})}else{return oc.apply(this,arguments)}};
    window.__share=null;`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  async function open(w, h, scheme, opts) {
    opts = opts || {};
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme || 'light' }] });
    await send('Page.navigate', { url: PAGE }); for (let i = 0; i < 60; i++) { if (await ev('document.readyState') === 'complete') break; await sleep(100); } await sleep(250);
  }
  async function pick(file) { const doc = (await send('DOM.getDocument', { depth: 0 })).result.root.nodeId; const q = (await send('DOM.querySelector', { nodeId: doc, selector: '#file' })).result.nodeId; await send('DOM.setFileInputFiles', { nodeId: q, files: [file] }); await sleep(700); }
  const txt = sel => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent||''`);
  const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const vis = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e && e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden'})()`);
  const chip = (key, idv) => ev(`document.querySelector('.chip[data-key=${JSON.stringify(key)}][data-id=${JSON.stringify(idv)}]').click()`);
  const dims = () => ev('(()=>{const c=document.getElementById("out");return [c.width,c.height]})()');
  const px = (x, y) => ev(`Array.from(document.getElementById('out').getContext('2d').getImageData(${x},${y},1,1).data)`);
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= (tol || 0));
  const opt = o => ev(`(()=>{${Object.keys(o).map(k => `document.querySelector('.chip[data-key="${k}"][data-id="${o[k]}"]').click();`).join('')}})()`);
  const dump = async (name) => { const d = await ev('document.getElementById("out").toDataURL("image/png")'); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(d.split(',')[1], 'base64')); };
  const hash = async () => crypto.createHash('md5').update(await ev('document.getElementById("out").toDataURL("image/png")')).digest('hex');
  const BLUE = [30, 120, 200, 255], RED = [255, 0, 0, 255], GREEN = [0, 200, 0, 255], LGRAY = [242, 242, 242, 255], WHITE = [255, 255, 255, 255];

  // ---------- 初期状態（880px以上は2カラム） ----------
  await open(1000, 900);
  ok(await ev('getComputedStyle(document.querySelector(".layout")).display') === 'grid', '880px以上は2カラム');
  ok(await ev('getComputedStyle(document.querySelector(".col-out")).position') === 'sticky', '右は sticky');
  ok(await ev('document.querySelectorAll(".notes li").length') === 3, '常設の注意は3行');
  ok(!(await ev('document.getElementById("file").hasAttribute("accept")')), 'accept属性なし');
  ok(!(await vis('#opts')) && !(await vis('#srcSec')) && !(await vis('#resBox')) && await vis('#empty'), '画像を選ぶ前は選択肢・結果が出ない');
  ok(await ev('[...document.querySelectorAll(".chip[aria-pressed=true]")].map(c=>c.dataset.key+":"+c.dataset.id).join(",")') === 'ratio:1:1,pad:m,bg:lgray,radius:s,shadow:on', '選択肢の初期値');
  ok(await ev('document.querySelectorAll(".chip").length') === 4 + 3 + 10 + 3 + 2, 'チップの数');
  ok(await ev('document.getElementById("iosHint").hidden') === true, 'PCではiPhone向け案内は出ない');

  // ---------- S1 縦長 1170x2532 ----------
  await pick(fx('s1-tall-1170x2532.png'));
  ok((await txt('#status')).includes('読み込みました'), 'S1 ステータス ' + await txt('#status'));
  ok((await txt('#srcDims')).includes('1170×2532 px（PNG）'), 'S1 元の寸法表示 ' + await txt('#srcDims'));
  ok((await txt('#srcName')) === 's1-tall-1170x2532.png', 'S1 ファイル名');
  ok(await vis('#opts') && await vis('#srcSec') && await vis('#resBox') && !(await vis('#empty')), 'S1 選択肢・結果が出る');
  let d = await dims(); ok(d[0] === 1080 && d[1] === 1080, 'S1 出力 1080x1080 ' + d);
  ok(!(await vis('#blurWarn')), 'S1 縮小なのでぼやけ警告なし');
  ok((await txt('#outInfo')).includes('1080×1080') && (await txt('#outInfo')).includes('余白 86'), 'S1 出力情報 ' + await txt('#outInfo'));
  await opt({ shadow: 'off', radius: 'none', bg: 'white' });
  // 画像の位置: x=330, y=86（dw=420,dh=908）。中央は青、余白は白
  ok(near(await px(540, 540), BLUE), 'S1 中央は画像の青');
  ok(near(await px(5, 5), WHITE) && near(await px(1074, 1074), WHITE), 'S1 四隅は背景');
  ok(near(await px(330 + 10, 86 + 10), RED) && near(await px(330 + 420 - 10, 86 + 908 - 10), GREEN), 'S1 画像の左上は赤・右下は緑（向きが正しい）');
  ok(near(await px(329, 540), WHITE) && near(await px(330, 540), BLUE) && near(await px(749, 540), BLUE) && near(await px(750, 540), WHITE), 'S1 左右の余白が等しい（330/330）');
  ok(near(await px(540, 85), WHITE) && near(await px(540, 86), BLUE) && near(await px(540, 993), BLUE) && near(await px(540, 994), WHITE), 'S1 上下の余白が等しい（86/86）');
  await opt({ bg: 'lgray' }); ok(near(await px(5, 5), LGRAY), 'S1 薄灰'); await dump('A-s1-1x1-white'); // 白で出す
  await opt({ bg: 'white' }); await dump('A-s1-1x1-white');
  // 角丸と影（Dの数値は check-output.py）
  await opt({ radius: 'l' }); await dump('D-s1-radius-l-shadow-off');
  ok(near(await px(330, 86), WHITE) && near(await px(331, 87), WHITE, 0), 'S1 角丸大: 画像の角のピクセルは背景');
  ok(!near(await px(330 + 60, 86 + 3), WHITE, 20), 'S1 角丸大: 角から離れた辺は画像');
  // 影: ありにすると、画像のすぐ下が背景より暗い
  const below = await px(540, 86 + 908 + 6); await opt({ shadow: 'on' }); const belowOn = await px(540, 86 + 908 + 6);
  ok(belowOn[0] < below[0] - 10, `S1 影あり: 画像の下が暗い ${below[0]} -> ${belowOn[0]}`);
  const above = await px(540, 86 - 6); ok(above[0] > belowOn[0], 'S1 影は下にずれる（上のほうが明るい）');

  // ---------- S2 横長 2560x1440（JPEG） ----------
  await pick(fx('s2-wide-2560x1440.jpg'));
  ok((await txt('#srcDims')).includes('2560×1440 px（JPEG）'), 'S2 JPEGの寸法');
  d = await dims(); ok(d[0] === 1080 && d[1] === 1080, 'S2 選択肢は維持して1:1 ' + d);
  await chip('ratio', '4:5'); d = await dims(); ok(d[0] === 1080 && d[1] === 1350, 'S2 4:5 = 1080x1350 ' + d);
  await opt({ shadow: 'off', radius: 'none', bg: 'black' }); await dump('B-s2-4x5-black');
  await chip('ratio', '16:9'); d = await dims(); ok(d[0] === 1920 && d[1] === 1080, 'S2 16:9 = 1920x1080 ' + d);
  await opt({ pad: 'l', bg: 'white' }); await dump('C-s2-16x9-pad-l');
  ok(near(await px(5, 5), WHITE) && near(await px(1915, 1075), WHITE), 'S2 16:9 四隅は背景');

  // ---------- S3 透過PNG ----------
  await opt({ ratio: '1:1', pad: 'm', bg: 'white', radius: 'none', shadow: 'off' });
  await pick(fx('s3-transparent.png'));
  // 400x400 -> 2倍の800x800、x=y=140。左上（透明）は背景の白、円の中心はオレンジ
  ok(near(await px(140 + 5, 140 + 5), WHITE), 'S3 透過部分は背景色（黒く抜けない）' + await px(145, 145));
  ok(near(await px(540, 540), [255, 140, 0, 255]), 'S3 円の中心は不透明のオレンジ');
  await dump('G-s3-transparent-white');
  await opt({ shadow: 'on', radius: 's' }); const tp = await px(140 + 5, 140 + 5); ok(tp[0] > 150 && tp[1] > 150 && tp[2] > 150, 'S3 影あり・角丸ありでも透過部分は黒くならない ' + tp);
  ok(await vis('#blurWarn'), 'S3 400px -> 800px の拡大でぼやけ警告');

  // ---------- S4 小さい画像 480x320 ----------
  await opt({ shadow: 'on', bg: 'dgray', radius: 'l', ratio: '4:5' });
  await pick(fx('s4-small-480x320.png'));
  ok(await vis('#blurWarn') && (await txt('#blurWarn')).includes('元の画像が小さいため、ぼやけることがあります'), 'S4 ぼやけ警告');
  ok((await txt('#outInfo')).includes('拡大'), 'S4 拡大の表示 ' + await txt('#outInfo'));
  d = await dims(); ok(d[0] === 1080 && d[1] === 1350, 'S4 4:5');
  ok(/元の1[89]\d%に拡大/.test(await txt('#outInfo')) , 'S4 拡大率が2倍以内（189%） ' + await txt('#outInfo'));
  await click('#saveBtn'); await sleep(800);
  let dl = await ev('window.__dl'); ok(dl.length === 1 && /^framed-4x5-\d{8}-\d{6}\.png$/.test(dl[0].download) && dl[0].sig === '137,80,78,71,13,10,26,10' && dl[0].size > 1000, 'S4 保存できる（PNG署名・ファイル名） ' + JSON.stringify(dl));
  ok((await txt('#saveMsg')).includes('ダウンロードを試しました'), 'S4 保存の案内');
  await opt({ ratio: '1:1' }); ok(await vis('#blurWarn'), 'S4 1:1でも警告（拡大）');
  await chip('ratio', 'orig'); ok(!(await vis('#blurWarn')), 'S4 元の比率なら拡大しないので警告なし');
  await chip('ratio', '1:1');

  // ---------- S5 巨大画像 8000x6000 ----------
  await pick(fx('s5-huge-8000x6000.png'));
  ok((await txt('#srcDims')).includes('8000×6000 px'), 'S5 元の寸法は8000x6000');
  ok(await vis('#srcNote') && (await txt('#srcNote')).includes('4096'), 'S5 縮小の1行 ' + await txt('#srcNote'));
  d = await dims(); ok(d[0] === 1080 && d[1] === 1080, 'S5 出力できる');
  await opt({ shadow: 'off', radius: 'none', bg: 'white' }); ok(near(await px(540, 540), BLUE, 3), 'S5 中央は画像の青');
  ok(!(await vis('#blurWarn')), 'S5 縮小なので警告なし');

  // ---------- S6 Orientation=6 ----------
  await opt({ ratio: '1:1', pad: 'm', bg: 'white', radius: 'none', shadow: 'off' });
  await pick(fx('s6-orient6.jpg'));
  ok((await txt('#srcDims')).includes('200×400 px'), 'S6 向きを反映した寸法 ' + await txt('#srcDims'));
  // 200x400 -> s=2（上限）-> 400x800、x=340,y=140。生データの左上の赤は、表示すると右上に来る
  ok(near(await px(340 + 400 - 15, 140 + 15), RED, 8), 'S6 赤は右上 ' + await px(725, 155));
  ok(near(await px(340 + 15, 140 + 15), BLUE, 8), 'S6 左上は青');
  ok(near(await px(340 + 15, 140 + 800 - 15), GREEN, 8), 'S6 緑は左下 ' + await px(355, 925));
  ok((await txt('#outInfo')).includes('2倍まで'), 'S6 拡大の上限の表示');

  // ---------- S7 画像でないファイルなど ----------
  const bad = [['s7-note.txt', '画像ファイルを選んでください'], ['s7-doc.pdf', '画像ファイルを選んでください'], ['s7-photo.heic', 'この形式（HEIC）は読めません'], ['s7-anim.gif', 'この形式（GIF）は読めません'], ['s7-vector.svg', 'この形式（SVG）は読めません'], ['s7-corrupt.png', '読み込めませんでした'], ['s9-over20mb.png', '20MBまで']];
  for (const [f, msg] of bad) {
    await pick(fx(f)); const s = await txt('#status');
    ok(s.includes(msg), `S7 ${f}: ${s}`); ok(await ev('document.getElementById("status").classList.contains("err")'), `S7 ${f}: エラー表示`);
    ok(!(await vis('#resBox')) && !(await vis('#srcSec')) && !(await vis('#opts')), `S7 ${f}: 前の画像が残らない`);
  }
  // WebP
  await pick(fx('s12-webp-900x500.webp')); ok((await txt('#srcDims')).includes('900×500 px（WebP）'), 'WebPを読める ' + await txt('#srcDims'));

  // ---------- S8 元の比率 ----------
  await opt({ ratio: 'orig', pad: 'm', shadow: 'off' });
  await pick(fx('s8-800x600.png')); d = await dims(); ok(d[0] === 914 && d[1] === 714, 'S8 800x600 -> 914x714（余白57） ' + d);
  ok(!(await vis('#blurWarn')), 'S8 拡大なし'); await dump('F-s8-orig-800x600');
  ok(near(await px(57 + 5, 57 + 5), RED, 6), 'S8 等倍で左上が赤（余白57の内側）');
  await pick(fx('s8-4000x3000.png')); d = await dims(); ok(d[0] === 1600 + 2 * Math.round(1200 * 0.08 / 0.84) && d[1] === 1200 + 2 * Math.round(1200 * 0.08 / 0.84), 'S8 4000x3000 -> 長辺1600+余白 ' + d);
  await opt({ pad: 's' }); d = await dims(); ok(d[0] === 1600 + 2 * Math.round(1200 * 0.04 / 0.92), 'S8 余白 小');
  await opt({ pad: 'l' }); d = await dims(); ok(d[0] === 1600 + 2 * Math.round(1200 * 0.12 / 0.76), 'S8 余白 大');

  // ---------- S11 選び直し ----------
  await opt({ ratio: '4:5', pad: 'm', radius: 's', shadow: 'on', bg: 'umi' });
  await pick(fx('s4-small-480x320.png')); ok(await vis('#blurWarn'), 'S11 小さい画像で警告');
  await pick(fx('s8-4000x3000.png'));
  ok(!(await vis('#blurWarn')), 'S11 選び直すと前の補足が残らない'); ok((await txt('#srcDims')).includes('4000×3000'), 'S11 寸法が入れ替わる'); ok((await txt('#srcName')) === 's8-4000x3000.png', 'S11 ファイル名');
  ok(!(await vis('#lp')) || (await ev('document.getElementById("lp").children.length')) === 0, 'S11 長押し表示が残らない');
  ok(await ev('document.querySelector(".chip[data-key=ratio][data-id=\\"4:5\\"]").getAttribute("aria-pressed")') === 'true' && await ev('document.querySelector(".chip[data-key=bg][data-id=umi]").getAttribute("aria-pressed")') === 'true', 'S11 選択肢は維持');
  d = await dims(); ok(d[0] === 1080 && d[1] === 1350, 'S11 維持した比率で出る');
  // 選び直しの途中で別のファイル（遅い読み込みの結果が後から上書きしない）
  // 失敗したあと、成功を選び直せる
  await pick(fx('s7-note.txt')); await pick(fx('s1-tall-1170x2532.png')); ok((await txt('#srcDims')).includes('1170×2532'), 'S11 エラーのあとでも選び直せる');

  // ---------- サンプル ----------
  await click('#sampleBtn'); await sleep(300);
  ok((await txt('#srcDims')).includes('1170×2532'), 'サンプル 1170x2532'); ok((await txt('#srcName')).includes('架空'), 'サンプルは架空と表示');
  ok(await vis('#resBox'), 'サンプルで結果が出る');
  const sampleHash = await hash(); await opt({ bg: 'mori' }); ok((await hash()) !== sampleHash, 'サンプル: 背景を変えると結果が変わる');

  // ---------- 連打しても崩れない ----------
  await pick(fx('s2-wide-2560x1440.jpg'));
  await ev(`(()=>{const ids=[['ratio','4:5'],['pad','l'],['bg','mori'],['radius','l'],['shadow','off'],['ratio','16:9'],['pad','s'],['bg','sumi'],['radius','none'],['shadow','on'],['ratio','orig'],['ratio','1:1']];for(let r=0;r<20;r++)for(const [k,v] of ids)document.querySelector('.chip[data-key="'+k+'"][data-id="'+v+'"]').click();document.querySelector('.chip[data-key="pad"][data-id="m"]').click();document.querySelector('.chip[data-key="bg"][data-id="lgray"]').click();document.querySelector('.chip[data-key="radius"][data-id="s"]').click();})()`);
  d = await dims(); ok(d[0] === 1080 && d[1] === 1080, '連打のあとでも結果が正しい寸法');
  ok(await ev('document.querySelectorAll(".chip[aria-pressed=true]").length') === 5, '連打のあと、各段で選択中はちょうど1つ');
  ok(near(await px(5, 5), LGRAY), '連打のあと背景は最後の選択（薄灰）');

  // ---------- 貼り付け・ドロップ ----------
  await ev(`(async()=>{const c=document.createElement('canvas');c.width=300;c.height=200;const g=c.getContext('2d');g.fillStyle='#1e78c8';g.fillRect(0,0,300,200);const b=await new Promise(r=>c.toBlob(r,'image/png'));window.__f=new File([b],'<img src=x onerror=alert(1)>.png',{type:'image/png'});})()`);
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(window.__f);document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))})()`); await sleep(600);
  ok((await txt('#srcDims')).includes('300×200'), '貼り付けで読み込める');
  ok((await txt('#srcName')) === '<img src=x onerror=alert(1)>.png' && (await ev('document.querySelectorAll("#srcName img").length')) === 0 && (await ev('window.__xss')) === 0, 'ファイル名はテキストとして表示（HTMLにならない）');
  await pick(fx('s2-wide-2560x1440.jpg'));
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(window.__f);const e=new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true});document.getElementById('drop').dispatchEvent(e)})()`); await sleep(600);
  ok((await txt('#srcDims')).includes('300×200'), 'ドロップで読み込める');
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(window.__f);dt.items.add(window.__f);document.getElementById('drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))})()`); await sleep(600);
  ok((await txt('#status')).includes('最初の1枚だけ'), '複数ファイルは最初の1枚だけと表示');
  await ev(`(()=>{const dt=new DataTransfer();dt.setData('text/plain','hello');document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))})()`); await sleep(200);
  ok((await txt('#srcDims')).includes('300×200'), '文字の貼り付けは無視される（画像が消えない）');

  // ---------- 外部通信・保存なし ----------
  const net = (await ev('window.__net')).filter(x => !/cloudflareinsights/.test(x)); ok(net.length === 0, '自前の通信なし ' + JSON.stringify(net));
  ok((await ev('window.__ls')).length === 0, 'localStorage/sessionStorage/IndexedDB に書いていない');
  ok(errs.length === 0, 'ページ内の例外なし ' + errs.join('|'));

  // ---------- 保存の経路（iPhone UAを模す） ----------
  await send('Emulation.setUserAgentOverride', { userAgent: IPHONE_UA, platform: 'iPhone' });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await open(375, 800);
  ok(await ev('navigator.userAgent').then(u => u.includes('iPhone')), 'UA上書き');
  ok(await ev('document.getElementById("iosHint").hidden') === false, 'iPhone: 保存の案内が出る'); ok((await txt('#iosHint')).includes('共有メニュー'), 'iPhone: 案内の文言');
  ok((await txt('#viewBtn')).includes('長押しで保存'), 'iPhone: 表示ボタンの文言');
  await click('#sampleBtn'); await sleep(300);
  await ev(`Object.defineProperty(navigator,'canShare',{value:(d)=>!!(d&&d.files&&d.files.length),configurable:true});Object.defineProperty(navigator,'share',{value:(d)=>{window.__share={n:d.files.length,name:d.files[0].name,type:d.files[0].type,size:d.files[0].size};return Promise.resolve()},configurable:true});`);
  await click('#saveBtn'); await sleep(300);
  let sh = await ev('window.__share'); ok(sh && sh.n === 1 && /^framed-1x1-\d{8}-\d{6}\.png$/.test(sh.name) && sh.type === 'image/png' && sh.size > 1000, 'iPhone: 共有シートにPNGのFileを渡す ' + JSON.stringify(sh));
  ok((await ev('window.__dl')).length === 0, 'iPhone: 通常のダウンロードは使わない'); ok((await txt('#saveMsg')).includes('共有メニューを閉じました'), 'iPhone: 共有後の案内');
  await ev(`Object.defineProperty(navigator,'share',{value:()=>Promise.reject(Object.assign(new Error('x'),{name:'AbortError'})),configurable:true})`);
  await click('#saveBtn'); await sleep(300); ok((await txt('#saveMsg')).includes('保存はされていません') && (await ev('document.querySelectorAll("#lp img").length')) === 0, 'iPhone: キャンセルは長押し表示にしない');
  await ev(`Object.defineProperty(navigator,'share',{value:()=>Promise.reject(Object.assign(new Error('x'),{name:'NotAllowedError'})),configurable:true})`);
  await click('#saveBtn'); await sleep(300);
  ok((await ev('document.querySelectorAll("#lp img").length')) === 1 && (await ev('document.querySelector("#lp img").alt')) === '整えた画像（長押しで保存）' && (await txt('#lp')).includes('長押し'), 'iPhone: 共有が失敗したら画像を出して長押し');
  await ev(`Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true})`);
  await click('#saveBtn'); await sleep(200); ok((await txt('#lp')).includes('この端末では共有メニューを使えません'), 'iPhone: 共有不可なら長押しの案内');
  await click('#viewBtn'); await sleep(200); ok((await ev('document.querySelectorAll("#lp img").length')) === 1, '画像を表示ボタンで長押し表示');
  const lpOk = await ev(`(async()=>{const im=document.querySelector('#lp img');await new Promise(r=>{if(im.complete)r();else im.onload=r});return [im.naturalWidth,im.naturalHeight]})()`); ok(lpOk[0] === 1080 && lpOk[1] === 1080, '長押し用の画像は出力と同じ寸法 ' + lpOk);
  await click('.chip[data-key=ratio][data-id="4:5"]'); ok((await ev('document.getElementById("lp").children.length')) === 0, '設定を変えると長押し表示は消える');
  await send('Emulation.setUserAgentOverride', { userAgent: '' });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });

  // ---------- 狭い画面 375px ----------
  const m375 = async (label) => {
    const r = await ev(`(()=>{const de=document.documentElement;const small=[];const els=[...document.querySelectorAll('button,.chip,.drop,a')].filter(e=>e.getClientRects().length);
      for(const e of els){const b=e.getBoundingClientRect();const cs=getComputedStyle(e);if(e.tagName!=='A'&&b.height<43.5)small.push(e.className+':'+Math.round(b.height));if(e.tagName!=='A'&&parseFloat(cs.fontSize)<15.99)small.push('font:'+e.className+':'+cs.fontSize)}
      const over=[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>de.clientWidth+0.5).map(e=>e.tagName+'.'+e.className);
      return {sw:de.scrollWidth,cw:de.clientWidth,small,over:over.slice(0,5)}})()`);
    ok(r.sw <= r.cw, `${label}: 横スクロールなし ${r.sw}/${r.cw}`); ok(r.small.length === 0, `${label}: タップ領域44px・文字16px ${JSON.stringify(r.small)}`); ok(r.over.length === 0, `${label}: はみ出す要素なし ${JSON.stringify(r.over)}`);
  };
  await open(375, 800); await m375('375px 初期');
  await pick(fx('s2-wide-2560x1440.jpg')); await m375('375px 読み込み後');
  await opt({ ratio: '16:9', bg: 'asayake' }); await m375('375px 16:9');
  await pick(fx('s4-small-480x320.png')); await m375('375px 小さい画像（警告あり）');
  const cw = await ev('document.getElementById("out").getBoundingClientRect().width'); ok(cw > 300 && cw <= 343.5, '375px 結果のcanvasは幅いっぱい ' + cw);
  // チップ行の高さ（折り返しの様子）
  const rows = await ev(`[...document.querySelectorAll('.chips')].map(c=>Math.round(c.getBoundingClientRect().height))`); console.log('  チップ段の高さ(375px)', JSON.stringify(rows));
  // 最長の表示（長いファイル名）
  await ev(`(async()=>{const c=document.createElement('canvas');c.width=300;c.height=200;const b=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([b],'とても長いファイル名のスクリーンショット_2026年10月12日_午前9時41分_みなと堂売上一覧.png',{type:'image/png'}));document.getElementById('drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))})()`); await sleep(500);
  await m375('375px 長いファイル名');

  // ---------- ダーク（S9: 出力はページの配色に依存しない） ----------
  async function sceneHash(scheme) {
    await open(1000, 900, scheme); await pick(fx('s1-tall-1170x2532.png'));
    await opt({ ratio: '4:5', pad: 'l', bg: 'sumi', radius: 'l', shadow: 'on' }); const h1 = await hash();
    await opt({ ratio: '1:1', bg: 'white', shadow: 'off', radius: 'none' }); const h2 = await hash();
    const bgc = await ev('getComputedStyle(document.body).backgroundColor');
    const p0 = await px(5, 5), pc = await px(540, 540);
    return { h1, h2, bgc, p0, pc };
  }
  const L1 = await sceneHash('light'), D1 = await sceneHash('dark');
  ok(L1.bgc !== D1.bgc, `S9 ページの配色は実際に変わっている ${L1.bgc} / ${D1.bgc}`);
  ok(L1.h1 === D1.h1 && L1.h2 === D1.h2, 'S9 ライトとダークで出力PNGが同一');
  ok(near(D1.p0, WHITE) && near(D1.pc, BLUE), 'S9 ダークでも四隅は背景・中央は画像の色');
  // ダークの画面の確認（アクセントのコントラストはrun-checks）
  await open(375, 800, 'dark'); await pick(fx('s2-wide-2560x1440.jpg')); await m375('375px ダーク');

  // ---------- <img> フォールバック（createImageBitmapが使えないブラウザ）で向きが合う ----------
  const fbHook = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'delete window.createImageBitmap;' });
  await open(1000, 900); ok(await ev('typeof createImageBitmap') === 'undefined', 'フォールバック: createImageBitmap を無効化');
  await pick(fx('s6-orient6.jpg')); await opt({ ratio: '1:1', pad: 'm', bg: 'white', radius: 'none', shadow: 'off' });
  ok((await txt('#srcDims')).includes('200×400 px'), 'S6(<img>) 向きを反映した寸法 ' + await txt('#srcDims'));
  ok(near(await px(340 + 400 - 15, 140 + 15), RED, 8), 'S6(<img>) 赤は右上');
  await pick(fx('s1-tall-1170x2532.png')); ok((await txt('#srcDims')).includes('1170×2532'), 'フォールバックでもPNGを読める');
  await pick(fx('s7-corrupt.png')); ok((await txt('#status')).includes('読み込めませんでした'), 'フォールバックでも壊れた画像は止まる');
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fbHook.result.identifier });

  fs.writeFileSync(path.join(OUT, 'expect.json'), JSON.stringify({ note: 'check-output.py が参照する' }));
  console.log(`e2e: ${pass}/${pass + fail} 通過` + (fail ? `、失敗 ${fail}` : ''));
  ws.close(); chrome.kill(); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => { console.error('E2E ERROR', e); process.exit(2); });
