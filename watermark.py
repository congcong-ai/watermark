import argparse
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont, ImageOps

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def find_font(explicit: Optional[str] = None) -> Optional[str]:
    if explicit:
        p = Path(explicit)
        if p.is_file():
            return str(p)
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for c in candidates:
        if Path(c).is_file():
            return c
    return None


def add_text_watermark(
    img: Image.Image,
    text: str,
    opacity: float = 0.3,
    scale: float = 0.04,
    margin_ratio: float = 0.02,
    font_path: Optional[str] = None,
    angle: float = 45.0,
) -> Image.Image:
    img = ImageOps.exif_transpose(img)
    w, h = img.size
    base = img.convert("RGBA")

    txt_layer = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(txt_layer)

    size = max(12, int(min(w, h) * scale))
    fp = find_font(font_path)
    try:
        font = ImageFont.truetype(fp, size=size) if fp else ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    margin = int(min(w, h) * margin_ratio)
    alpha = max(0, min(255, int(255 * opacity)))
    shadow_alpha = max(0, min(255, int(alpha * 0.5)))

    padding = max(2, int(size * 0.2))
    text_img = Image.new("RGBA", (tw + padding * 2, th + padding * 2), (255, 255, 255, 0))
    tdraw = ImageDraw.Draw(text_img)
    tdraw.text((padding + 1, padding + 1), text, font=font, fill=(0, 0, 0, shadow_alpha))
    tdraw.text((padding, padding), text, font=font, fill=(255, 255, 255, alpha))

    rotated = text_img.rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))

    x = max(0, w - rotated.width - margin)
    y = max(0, h - rotated.height - margin)
    txt_layer.paste(rotated, (x, y), rotated)

    combined = Image.alpha_composite(base, txt_layer)

    if img.mode == "RGBA":
        return combined
    if img.mode in ("RGB", "L"):
        return combined.convert(img.mode)
    try:
        return combined.convert("RGB")
    except Exception:
        return combined


def is_image_file(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in ALLOWED_EXTS


def is_subpath(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False

def process_image_file(in_path: Path, out_path: Path, text: str, opacity: float, scale: float, margin_ratio: float, font_path: Optional[str], angle: float) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(in_path) as im:
        wm = add_text_watermark(im, text=text, opacity=opacity, scale=scale, margin_ratio=margin_ratio, font_path=font_path, angle=angle)
        ext = in_path.suffix.lower()
        save_kwargs = {}
        if ext in {".jpg", ".jpeg"}:
            save_kwargs = {"quality": 90, "optimize": True}
            wm = wm.convert("RGB")
        wm.save(out_path, **save_kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", "-i", type=str, default="pictures", help="输入图片目录")
    parser.add_argument("--output", "-o", type=str, default=None, help="输出目录，默认为 input 下的 watermarked 子目录")
    parser.add_argument("--text", type=str, default="congcong", help="水印文字")
    parser.add_argument("--opacity", type=float, default=0.3, help="不透明度 0-1，越小越不明显")
    parser.add_argument("--scale", type=float, default=0.04, help="字体相对尺寸，按 min(W,H) 的比例")
    parser.add_argument("--margin", type=float, default=0.02, help="边距相对尺寸，按 min(W,H) 的比例")
    parser.add_argument("--font", type=str, default=None, help="自定义字体文件路径，可选")
    parser.add_argument("--angle", type=float, default=45.0, help="水印旋转角度（度），默认 45")
    parser.add_argument("--no-recursive", action="store_true", help="不递归子目录")

    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"输入目录不存在: {input_dir}")

    output_dir = Path(args.output).resolve() if args.output else (input_dir / "watermarked")
    output_dir.mkdir(parents=True, exist_ok=True)

    files = (
        (p, output_dir / p.relative_to(input_dir))
        for p in (input_dir.rglob("*") if not args.no_recursive else input_dir.glob("*"))
        if is_image_file(p) and not is_subpath(p, output_dir)
    )

    total, ok = 0, 0
    for src, dst in files:
        total += 1
        try:
            process_image_file(
                src,
                dst,
                text=args.text,
                opacity=args.opacity,
                scale=args.scale,
                margin_ratio=args.margin,
                font_path=args.font,
                angle=args.angle,
            )
            ok += 1
            print(f"✅ 已处理: {src} -> {dst}")
        except Exception as e:
            print(f"❌ 失败: {src} | {e}")

    print(f"完成。成功 {ok}/{total} 张。输出目录: {output_dir}")


if __name__ == "__main__":
    main()
