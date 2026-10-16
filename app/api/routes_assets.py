import base64
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from PIL import Image, ImageDraw
from app.core.image_ops import create_headless_character_sheet, render_red_arrow_contact_sheet
from app.api.routes_events import broadcast_event

router = APIRouter(prefix="/api/assets", tags=["assets"])


class HeadlessCropRequest(BaseModel):
    src_path: Optional[str] = None
    dest_path: Optional[str] = None
    out_path: Optional[str] = None
    top_crop_ratio: float = 0.22
    crop_top_ratio: Optional[float] = None
    data_url: Optional[str] = None
    character_handle: Optional[str] = "@character"


class ContactSheetRequest(BaseModel):
    base_img_path: Optional[str] = None
    out_img_path: str
    arrows: Optional[List[Dict[str, Any]]] = None
    anchor_boxes: Optional[List[Dict[str, Any]]] = None
    data_url: Optional[str] = None  # Optional base64 dataURL from frontend canvas


@router.post("/headless-crop")
async def crop_headless_sheet(req: HeadlessCropRequest):
    """Crop character turnaround sheet to strip upper head/face region and lock wardrobe."""
    try:
        target_dest = req.dest_path or req.out_path
        if not target_dest:
            raise ValueError("Either dest_path or out_path is required")
        ratio = req.crop_top_ratio if req.crop_top_ratio is not None else req.top_crop_ratio
        dest = Path(target_dest)
        dest.parent.mkdir(parents=True, exist_ok=True)

        # If data_url uploaded from browser or no src_path exists, prepare source image
        if req.data_url:
            src_tmp = dest.parent / f"{dest.stem}_raw_full.png"
            header, encoded = req.data_url.split(",", 1) if "," in req.data_url else ("", req.data_url)
            src_tmp.write_bytes(base64.b64decode(encoded))
            actual_src = str(src_tmp)
        elif req.src_path and Path(req.src_path).exists():
            actual_src = req.src_path
        elif req.src_path and not Path(req.src_path).exists():
            raise FileNotFoundError(f"Source image not found: {req.src_path}")
        else:
            # Generate a realistic 3-panel turnaround schematic sheet so the user can visually see the top 22% head crop!
            src_tmp = dest.parent / f"{dest.stem}_raw_full.png"
            img = Image.new("RGB", (900, 600), color=(18, 22, 32))
            draw = ImageDraw.Draw(img)
            # Draw 3 panels (Front / Side / Back) with head zone highlighted
            crop_y = int(600 * ratio)
            draw.rectangle([0, 0, 900, crop_y], fill=(60, 20, 25))
            draw.line([0, crop_y, 900, crop_y], fill=(239, 68, 68), width=3)
            draw.text((20, 15), f"TOP {int(ratio*100)}% HEAD ZONE (TO BE CROPPED TO PREVENT FACE AVERAGING)", fill=(255, 120, 120))
            for i, view_name in enumerate(["FRONT VIEW", "SIDE PROFILE", "BACK VIEW"]):
                cx = 150 + i * 300
                # Head circle (in top zone)
                draw.ellipse([cx - 32, 45, cx + 32, 115], outline=(255, 160, 160), width=2)
                # Torso & Wardrobe (in safe body zone)
                draw.rectangle([cx - 65, crop_y + 15, cx + 65, 380], fill=(35, 50, 75), outline=(56, 189, 248), width=2)
                # Legs
                draw.rectangle([cx - 55, 385, cx - 10, 540], fill=(28, 38, 58), outline=(56, 189, 248), width=2)
                draw.rectangle([cx + 10, 385, cx + 55, 540], fill=(28, 38, 58), outline=(56, 189, 248), width=2)
                draw.text((cx - 45, 555), f"{req.character_handle} {view_name}", fill=(200, 220, 255))
            img.save(src_tmp)
            actual_src = str(src_tmp)

        meta = create_headless_character_sheet(
            src_path=actual_src,
            dest_path=target_dest,
            top_crop_ratio=ratio,
        )
        meta["cropped_path"] = target_dest
        return meta
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/contact-sheet")
async def create_contact_sheet(req: ContactSheetRequest):
    """Render red-arrow contact sheet PNG from base image + annotations or save base64 dataURL."""
    out_path = Path(req.out_img_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Handle base64 dataURL from frontend canvas
    if req.data_url:
        try:
            # Format: "data:image/png;base64,xxxx..."
            header, encoded = req.data_url.split(",", 1) if "," in req.data_url else ("", req.data_url)
            data = base64.b64decode(encoded)
            out_path.write_bytes(data)
            return {
                "out_path": str(out_path),
                "saved_from": "data_url",
                "bytes": len(data),
                "status": "saved",
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode data_url: {e}")

    # 2. Handle base image + annotations rendering
    if not req.base_img_path:
        raise HTTPException(status_code=400, detail="Either 'base_img_path' or 'data_url' must be provided")

    try:
        meta = render_red_arrow_contact_sheet(
            base_img_path=req.base_img_path,
            out_img_path=req.out_img_path,
            arrows=req.arrows,
            anchor_boxes=req.anchor_boxes,
        )
        return meta
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
