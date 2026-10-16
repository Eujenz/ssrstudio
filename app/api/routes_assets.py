import base64
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.image_ops import create_headless_character_sheet, render_red_arrow_contact_sheet
from app.api.routes_events import broadcast_event

router = APIRouter(prefix="/api/assets", tags=["assets"])


class HeadlessCropRequest(BaseModel):
    src_path: str
    dest_path: str
    top_crop_ratio: float = 0.22


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
        meta = create_headless_character_sheet(
            src_path=req.src_path,
            dest_path=req.dest_path,
            top_crop_ratio=req.top_crop_ratio,
        )
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
