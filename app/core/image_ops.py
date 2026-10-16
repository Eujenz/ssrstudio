import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from PIL import Image, ImageDraw, ImageFont
from PIL.PngImagePlugin import PngInfo


def create_headless_character_sheet(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    top_crop_ratio: float = 0.22,
) -> Dict[str, Any]:
    """
    Higgsfield Hell Grind asset defense tool:
    Crops the upper head/face region from a character turnaround sheet (default 22%)
    to eliminate facial identity distortion and force model adherence to wardrobe and anatomy locks.
    Stamps identity safeguard metadata into the resulting image.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)

    if not src_path.exists():
        raise FileNotFoundError(f"Source image not found: {src_path}")

    with Image.open(src_path) as img:
        img_w, img_h = img.size
        cropped_top_px = int(round(img_h * top_crop_ratio))
        crop_box = (0, cropped_top_px, img_w, img_h)
        cropped_img = img.crop(crop_box)

        dest_path.parent.mkdir(parents=True, exist_ok=True)

        metadata = {
            "src_path": str(src_path),
            "dest_path": str(dest_path),
            "original_size": (img_w, img_h),
            "cropped_size": (cropped_img.width, cropped_img.height),
            "top_crop_ratio": top_crop_ratio,
            "cropped_top_px": cropped_top_px,
            "safeguard_stamped": True,
            "safeguard_note": (
                "Headless turnaround crop applied: upper facial features stripped "
                "to eliminate identity hallucination and enforce wardrobe/anatomy lock."
            ),
        }

        # Embed PNG text metadata if saving to PNG format
        if dest_path.suffix.lower() == ".png":
            png_info = PngInfo()
            png_info.add_text("Safeguard", "HeadlessTurnaroundLock")
            png_info.add_text("CroppedTopPx", str(cropped_top_px))
            png_info.add_text("TopCropRatio", str(top_crop_ratio))
            png_info.add_text("Note", metadata["safeguard_note"])
            cropped_img.save(dest_path, format="PNG", pnginfo=png_info)
        else:
            cropped_img.save(dest_path)

    return metadata


def render_red_arrow_contact_sheet(
    base_img_path: Union[str, Path],
    out_img_path: Union[str, Path],
    arrows: Optional[List[Dict[str, Any]]] = None,
    anchor_boxes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Higgsfield Hell Grind contact sheet renderer:
    Composites high-contrast #FF0000 red contact arrows, direction vectors, and anchor bounding boxes
    directly onto actual base images to generate real pre-compositing reference PNGs for AI video models.
    """
    base_img_path = Path(base_img_path)
    out_img_path = Path(out_img_path)

    if not base_img_path.exists():
        raise FileNotFoundError(f"Base image not found: {base_img_path}")

    arrows = arrows or []
    anchor_boxes = anchor_boxes or []

    with Image.open(base_img_path) as base_img:
        img = base_img.convert("RGB")
        draw = ImageDraw.Draw(img)

        # Load default font
        font = ImageFont.load_default()

        # 1. Render anchor boxes (#FF0000 outline)
        for box in anchor_boxes:
            x1 = box.get("x1", 0)
            y1 = box.get("y1", 0)
            x2 = box.get("x2", 0)
            y2 = box.get("y2", 0)
            label = box.get("label", "")
            color = box.get("color", "#FF0000")

            # Draw box boundary with width 3
            draw.rectangle([(x1, y1), (x2, y2)], outline=color, width=3)

            # Draw label tag above anchor box
            if label:
                text_tag = f"[{label}]"
                bbox = draw.textbbox((x1, max(0, y1 - 16)), text_tag, font=font)
                bg_box = (bbox[0] - 3, bbox[1] - 2, bbox[2] + 3, bbox[3] + 2)
                draw.rectangle(bg_box, fill="#FF0000")
                draw.text((bbox[0], bbox[1]), text_tag, fill="#FFFFFF", font=font)

        # 2. Render red contact arrows (#FF0000 line + directional arrowhead)
        for arrow in arrows:
            x1 = arrow.get("x1") if "x1" in arrow else arrow.get("start", [0, 0])[0]
            y1 = arrow.get("y1") if "y1" in arrow else arrow.get("start", [0, 0])[1]
            x2 = arrow.get("x2") if "x2" in arrow else arrow.get("end", [0, 0])[0]
            y2 = arrow.get("y2") if "y2" in arrow else arrow.get("end", [0, 0])[1]
            label = arrow.get("label", "")
            color = arrow.get("color", "#FF0000")
            line_width = arrow.get("width", 5)

            # Draw main arrow shaft
            draw.line([(x1, y1), (x2, y2)], fill=color, width=line_width)

            # Draw arrowhead pointing towards (x2, y2)
            dx = x2 - x1
            dy = y2 - y1
            length = math.sqrt(dx * dx + dy * dy)

            if length > 2:
                angle = math.atan2(dy, dx)
                head_len = min(26.0, max(14.0, length * 0.16))
                wing_angle = math.radians(28.0)

                # Two wing points forming the arrowhead triangle
                w1_x = x2 - head_len * math.cos(angle - wing_angle)
                w1_y = y2 - head_len * math.sin(angle - wing_angle)
                w2_x = x2 - head_len * math.cos(angle + wing_angle)
                w2_y = y2 - head_len * math.sin(angle + wing_angle)

                arrowhead = [(x2, y2), (w1_x, w1_y), (w2_x, w2_y)]
                draw.polygon(arrowhead, fill=color)

            # Draw label tag near midpoint
            if label:
                mx = (x1 + x2) / 2.0
                my = (y1 + y2) / 2.0 - 12.0
                text_tag = f" {label} "
                bbox = draw.textbbox((mx, my), text_tag, font=font)
                bg_box = (bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2)
                # High-contrast tag: black backdrop, red border, white text
                draw.rectangle(bg_box, fill="#000000", outline="#FF0000", width=2)
                draw.text((bbox[0], bbox[1]), text_tag, fill="#FFFFFF", font=font)

        # 3. Stamp industrial watermark banner
        watermark_text = "HELL GRIND // RED-ARROW PRE-COMP CONTACT SHEET"
        wm_bbox = draw.textbbox((12, 12), watermark_text, font=font)
        wm_bg = (wm_bbox[0] - 4, wm_bbox[1] - 3, wm_bbox[2] + 4, wm_bbox[3] + 3)
        draw.rectangle(wm_bg, fill="#000000")
        draw.text((12, 12), watermark_text, fill="#FF0000", font=font)

        out_img_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_img_path, format="PNG")

    return {
        "out_path": str(out_img_path),
        "base_path": str(base_img_path),
        "arrows_count": len(arrows),
        "boxes_count": len(anchor_boxes),
        "image_size": (img.width, img.height),
        "status": "rendered",
    }
