from PIL import Image
import os

src_dir = "shields_64x64"
out_dir = "client/images/game/guild/emblem"

files = sorted([f for f in os.listdir(src_dir) if f.endswith('.png')],
               key=lambda f: (f.split('_')[0], int(f.split('_shield')[1].split('.')[0])))

for fname in files:
    img = Image.open(os.path.join(src_dir, fname)).convert("RGBA")
    resized = img.resize((16, 16), Image.LANCZOS)
    out_path = os.path.join(out_dir, fname)
    resized.save(out_path)
    print(f"{fname}: 64x64 -> 16x16")
