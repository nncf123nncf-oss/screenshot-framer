"""検算用の入力ファイルを作る（すべて架空の合成画像。実在の画面・写真は使わない）。
使い方: python source/make-fixtures.py <出力フォルダ>
中央は青(30,120,200)、左上に赤、右下に緑の四角を置き、向き・位置・色を数値で確かめられるようにする。"""
import sys, os, struct
from PIL import Image, ImageDraw

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
BLUE, RED, GREEN = (30, 120, 200), (255, 0, 0), (0, 200, 0)


def marked(w, h, mode='RGB', base=BLUE):
    im = Image.new(mode, (w, h), base if mode == 'RGB' else base + (255,))
    d = ImageDraw.Draw(im)
    m = max(8, min(w, h) // 8)
    d.rectangle([0, 0, m - 1, m - 1], fill=RED if mode == 'RGB' else RED + (255,))
    d.rectangle([w - m, h - m, w - 1, h - 1], fill=GREEN if mode == 'RGB' else GREEN + (255,))
    return im


def p(name):
    return os.path.join(out, name)


marked(1170, 2532).save(p('s1-tall-1170x2532.png'))
marked(2560, 1440).save(p('s2-wide-2560x1440.jpg'), quality=92)
# S3 透過PNG: 中央の円だけ不透明、ほかは透明（透明部分の色は黒(0,0,0,0)）
t = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
ImageDraw.Draw(t).ellipse([100, 100, 299, 299], fill=(255, 140, 0, 255))
t.save(p('s3-transparent.png'))
marked(480, 320).save(p('s4-small-480x320.png'))
marked(8000, 6000).save(p('s5-huge-8000x6000.png'))
# S6 Orientation=6（右に90度回して表示する）。生データは 400x200、左上に赤。表示すると 200x400 で、赤は右上に来る
o = marked(400, 200)
ex = Image.Exif(); ex[0x0112] = 6
o.save(p('s6-orient6.jpg'), quality=95, exif=ex)
# S7
open(p('s7-note.txt'), 'w', encoding='utf-8').write('これは画像ではありません。\n')
open(p('s7-doc.pdf'), 'wb').write(b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
open(p('s7-photo.heic'), 'wb').write(b'\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic' + b'\x00' * 64)
open(p('s7-corrupt.png'), 'wb').write(b'\x89PNG\r\n\x1a\n' + b'garbage-not-a-real-png' * 20)
Image.new('P', (40, 30), 3).save(p('s7-anim.gif'))
open(p('s7-vector.svg'), 'w', encoding='utf-8').write('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')
# S8
marked(800, 600).save(p('s8-800x600.png'))
marked(4000, 3000).save(p('s8-4000x3000.png'))
# 20MB超（先頭はPNGの署名。中身は読まれずに止まるはず）
with open(p('s9-over20mb.png'), 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n'); f.write(b'\0' * (21 * 1024 * 1024))
marked(600, 600).save(p('s11-second-600x600.png'))
# WebP
marked(900, 500).save(p('s12-webp-900x500.webp'), quality=90)
print('ok', len(os.listdir(out)), 'files')
