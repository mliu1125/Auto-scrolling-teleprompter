"""生成提词器应用图标（Apple 风格深色玻璃 + 蓝色高亮阅读行）。

用法：
    python scripts/make_icon.py

产物：
    build/icon.png  1024x1024 参考图
    build/icon.ico  多尺寸 Windows 图标
"""

import os
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")

ACCENT = (10, 132, 255)


def vertical_gradient(size, top, bottom):
    """生成竖直线性渐变。"""
    img = Image.new("RGB", (1, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((size, size), Image.BILINEAR)


def make_icon():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 背景：深色渐变
    base = vertical_gradient(SIZE, (44, 44, 46), (0, 0, 0)).convert("RGBA")

    # 圆角遮罩（squircle 观感：半径 224/1024）
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=224, fill=255)
    base.putalpha(mask)

    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # 顶部高光，模拟玻璃反光
    d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=224, outline=(255, 255, 255, 26), width=6)

    # 文本行：(y, 宽度, 颜色)
    bars = [
        (300, 420, (255, 255, 255, 90)),
        (440, 600, ACCENT + (255,)),
        (580, 520, (255, 255, 255, 120)),
        (720, 380, (255, 255, 255, 70)),
    ]
    left = 200
    bar_h = 62
    for y, width, color in bars:
        d.rounded_rectangle(
            [left, y, left + width, y + bar_h],
            radius=bar_h // 2,
            fill=color,
        )

    # 蓝色高亮行的辉光
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(
        [left - 18, 440 - 18, left + 600 + 18, 440 + bar_h + 18],
        radius=bar_h // 2 + 18,
        fill=ACCENT + (70,),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(28))

    icon = Image.alpha_composite(base, layer)

    # 合成一张独立的 PNG
    png_path = os.path.join(OUT_DIR, "icon.png")
    icon.save(png_path)

    ico_path = os.path.join(OUT_DIR, "icon.ico")
    icon.save(
        ico_path,
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print("生成完成:", png_path)
    print("生成完成:", ico_path)


if __name__ == "__main__":
    make_icon()
