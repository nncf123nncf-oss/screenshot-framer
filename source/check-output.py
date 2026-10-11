"""S12: e2e.js が書き出した出力PNGを Pillow で開き、寸法・四隅の色（背景）・中央付近（画像）・余白・角丸の角を数値で確認する。
期待値はこのファイルの中で仕様カードの式から独立に計算する（index.html の計算結果をそのまま写さない）。
使い方: python source/check-output.py <e2e.js の出力フォルダ>"""
import sys, os
from PIL import Image

d = sys.argv[1]
n = f = 0


def ok(c, m):
    global n, f
    n += 1
    if not c:
        f += 1
        print('NG', m)


def load(name):
    im = Image.open(os.path.join(d, name + '.png'))
    ok(im.format == 'PNG', f'{name} はPNG')
    return im.convert('RGBA')


def near(a, b, tol=0):
    return all(abs(x - y) <= tol for x, y in zip(a[:3], b[:3]))


def bbox_not(im, bg, tol=12):
    """背景色と違う画素の外接矩形（左,上,右(含まない),下(含まない)）"""
    W, H = im.size
    px = im.load()
    xs = [x for x in range(W) for y in (H // 2,) if not near(px[x, y], bg, tol)]
    ys = [y for y in range(H) for x in (W // 2,) if not near(px[x, y], bg, tol)]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


BLUE, RED, GREEN, WHITE, BLACK17 = (30, 120, 200), (255, 0, 0), (0, 200, 0), (255, 255, 255), (17, 17, 17)

# A: 縦長1170x2532 -> 1:1 / 余白 中 / 白 / 角丸なし / 影なし
im = load('A-s1-1x1-white'); W, H = im.size; px = im.load()
ok((W, H) == (1080, 1080), f'A 寸法 {im.size}')
p = round(1080 * 0.08); s = (1080 - 2 * p) / 2532; dw = round(1170 * s)
ok(p == 86 and dw == 420, 'A 期待値(p=86, 画像幅420)')
l, t, r, b = bbox_not(im, WHITE)
ok((l, t, r, b) == ((1080 - dw) // 2, p, 1080 - (1080 - dw) // 2, 1080 - p), f'A 画像の位置 {(l, t, r, b)}')
ok(l == 1080 - r and t == 1080 - b, 'A 左右・上下の余白が等しい')
ok(all(near(px[x, y], WHITE) for x, y in [(0, 0), (1079, 0), (0, 1079), (1079, 1079)]), 'A 四隅は背景の白')
ok(near(px[540, 540], BLUE), 'A 中央は画像の青')
ok(near(px[l + 10, t + 10], RED) and near(px[r - 10, b - 10], GREEN), 'A 画像の左上は赤・右下は緑')

# B: 横長2560x1440(JPEG) -> 4:5 / 黒(#111111)
im = load('B-s2-4x5-black'); W, H = im.size; px = im.load()
ok((W, H) == (1080, 1350), f'B 寸法 {im.size}')
ok(all(near(px[x, y], BLACK17) for x, y in [(0, 0), (1079, 0), (0, 1349), (1079, 1349)]), 'B 四隅は背景(#111111)')
l, t, r, b = bbox_not(im, BLACK17)
ok(l == 86 and 1080 - r == 86, f'B 左右の余白は86 {(l, 1080 - r)}')
ok(t == 1350 - b and 509 <= b - t <= 512, f'B 上下の余白が等しい・高さ約511 {(t, 1350 - b, b - t)}')
ok(near(px[540, 675], BLUE, 6), 'B 中央は画像の青（JPEGの誤差6以内）')

# C: 16:9 / 余白 大 / 白
im = load('C-s2-16x9-pad-l'); W, H = im.size; px = im.load()
ok((W, H) == (1920, 1080), f'C 寸法 {im.size}')
l, t, r, b = bbox_not(im, WHITE)
ok(t == 130 and 1080 - b == 130, f'C 上下の余白は130(=1080*12%) {(t, 1080 - b)}')
ok(l == 1920 - r and abs((r - l) - round(2560 * 820 / 1440)) <= 1, f'C 左右均等・幅約1458 {(l, 1920 - r, r - l)}')
ok(all(near(px[x, y], WHITE) for x, y in [(0, 0), (1919, 0), (0, 1079), (1919, 1079)]), 'C 四隅は背景')
ok(near(px[960, 540], BLUE, 6), 'C 中央は画像')

# D: 角丸 大(4% of 1080 = 43) / 影なし / 白
im = load('D-s1-radius-l-shadow-off'); px = im.load()
x0, y0, r = 330, 86, round(1080 * 0.04)
ok(r == 43, 'D 半径 43')
ok(near(px[x0, y0], WHITE) and near(px[x0 + 2, y0 + 2], WHITE) and near(px[x0 + 1, y0 + 1], WHITE), 'D 画像の角のピクセルは背景色（角丸で切れている）')
ok(near(px[x0 + 20, y0 + 20], RED), 'D 角から少し内側は画像（赤）')
ok(near(px[x0 + 419, y0 + 907], WHITE) and near(px[x0 + 419 - 20, y0 + 907 - 20], GREEN), 'D 右下の角も同様')
ok(near(px[x0 + 210, y0], BLUE) or near(px[x0 + 210, y0 + 1], BLUE), 'D 辺の中央は角丸の影響を受けない')

# F: 元の比率 800x600 / 余白 中 / 等倍
im = load('F-s8-orig-800x600'); W, H = im.size; px = im.load()
pp = round(600 * 0.08 / (1 - 2 * 0.08))
ok((W, H) == (800 + 2 * pp, 600 + 2 * pp) and pp == 57, f'F 寸法 {im.size} 余白{pp}')
ok(abs(pp - min(W, H) * 0.08) <= 1, 'F 余白は出力の短辺の約8%')
bg = px[0, 0]
l, t, r, b = bbox_not(im, bg)
ok((l, t, r, b) == (pp, pp, pp + 800, pp + 600), f'F 画像は等倍で余白の内側 {(l, t, r, b)}')
ok(near(px[pp + 5, pp + 5], RED) and near(px[pp + 795, pp + 595], GREEN), 'F 等倍のまま（拡大も縮小もしていない）')

# G: 透過PNG(400x400, 中央の円だけ不透明) / 白 / 影なし / 角丸なし -> 2倍の800x800、x=y=140
im = load('G-s3-transparent-white'); W, H = im.size; px = im.load()
ok((W, H) == (1080, 1080), 'G 寸法')
ok(near(px[145, 145], WHITE) and near(px[940, 940], WHITE), 'G 透明な部分は背景色（黒く抜けていない）')
ok(near(px[540, 540], (255, 140, 0)), 'G 円の中心は不透明のオレンジ')
ok(all(c[3] == 255 for c in [px[145, 145], px[540, 540], px[0, 0]]), 'G 出力に透明な画素がない')

print(f'S12: {n - f}/{n} 通過' + (f'、失敗 {f}' if f else ''))
sys.exit(1 if f else 0)
