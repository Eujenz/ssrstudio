import math
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from PIL import Image, ImageDraw, ImageFont

from app.core.tool_registry import (
    BaseImageProvider,
    BaseTTSProvider,
    BaseVideoProvider,
)
from app.models.project import ProjectState, ShotSpec, SpatialNode


class LocalAnimaticProvider:
    """Renders 100% offline, deterministic 2.39:1 (1920x804) technical animatic storyboard slates using Pillow.
    Draws:
    - 2.39:1 CinemaScope guide frame and rule-of-thirds composition grid
    - 2D Spatial radar visualization (subjects, camera position, viewing frustum cone, facing vectors)
    - Industrial metadata slate (title, shot ID, focal length, lens lock, timecode, Meisner stimulus, dialogue line)
    """

    WIDTH = 1920
    HEIGHT = 804

    def __init__(self) -> None:
        pass

    def render_shot_slate(
        self,
        project: ProjectState,
        shot: ShotSpec,
        out_path: Union[str, Path],
    ) -> str:
        """Renders technical animatic slate PNG to out_path."""
        out_path_obj = Path(out_path)
        out_path_obj.parent.mkdir(parents=True, exist_ok=True)

        # 1. Base Cinema Canvas (1920x804, 2.39:1 Anamorphic)
        img = Image.new("RGB", (self.WIDTH, self.HEIGHT), color=(11, 15, 25))
        draw = ImageDraw.Draw(img)

        font = ImageFont.load_default()

        # 2. Cinema Guide Frame (Safe Area)
        margin_x, margin_y = 40, 25
        draw.rectangle(
            [margin_x, margin_y, self.WIDTH - margin_x, self.HEIGHT - margin_y],
            outline=(40, 56, 80),
            width=2,
        )

        # 3. Rule of Thirds Grid Lines (Subtle dotted/dim lines)
        third_x1 = self.WIDTH // 3
        third_x2 = (self.WIDTH * 2) // 3
        third_y1 = self.HEIGHT // 3
        third_y2 = (self.HEIGHT * 2) // 3

        grid_color = (25, 36, 54)
        draw.line([(third_x1, margin_y), (third_x1, self.HEIGHT - margin_y)], fill=grid_color, width=1)
        draw.line([(third_x2, margin_y), (third_x2, self.HEIGHT - margin_y)], fill=grid_color, width=1)
        draw.line([(margin_x, third_y1), (self.WIDTH - margin_x, third_y1)], fill=grid_color, width=1)
        draw.line([(margin_x, third_y2), (self.WIDTH - margin_x, third_y2)], fill=grid_color, width=1)

        # 4. Central Spatial Radar Display
        # Radar Viewport in center: x from 600 to 1320, y from 130 to 620
        radar_cx, radar_cy = self.WIDTH // 2, (self.HEIGHT // 2) - 15
        radar_radius = 210

        # Radar concentric rings
        draw.ellipse(
            [radar_cx - radar_radius, radar_cy - radar_radius, radar_cx + radar_radius, radar_cy + radar_radius],
            outline=(35, 55, 80),
            width=2,
        )
        draw.ellipse(
            [radar_cx - (radar_radius // 2), radar_cy - (radar_radius // 2), radar_cx + (radar_radius // 2), radar_cy + (radar_radius // 2)],
            outline=(24, 38, 56),
            width=1,
        )
        draw.ellipse(
            [radar_cx - (radar_radius // 4), radar_cy - (radar_radius // 4), radar_cx + (radar_radius // 4), radar_cy + (radar_radius // 4)],
            outline=(20, 32, 48),
            width=1,
        )

        # Radar crosshairs
        draw.line([(radar_cx - radar_radius - 20, radar_cy), (radar_cx + radar_radius + 20, radar_cy)], fill=(28, 44, 65), width=1)
        draw.line([(radar_cx, radar_cy - radar_radius - 20), (radar_cx, radar_cy + radar_radius + 20)], fill=(28, 44, 65), width=1)

        # Radar Header
        draw.text((radar_cx - 75, radar_cy - radar_radius - 18), "2D SPATIAL RADAR BLOCKING", fill=(70, 110, 150), font=font)

        # 5. Render Spatial Nodes & Camera Frustum
        # Map normalized coordinates (0..1) to radar circle
        nodes = shot.spatial_nodes
        cam_node = next((n for n in nodes if n.role == "camera"), None)

        def norm_to_radar(nx: float, ny: float) -> tuple[float, float]:
            # Center is (0.5, 0.5)
            rx = radar_cx + (nx - 0.5) * (radar_radius * 1.6)
            ry = radar_cy + (ny - 0.5) * (radar_radius * 1.6)
            return rx, ry

        # Draw Camera & Viewing Cone Frustum
        cam_x, cam_y = norm_to_radar(cam_node.x if cam_node else 0.5, cam_node.y if cam_node else 0.85)

        # Frustum angle based on lens mm
        fov_angles = {24: 107.0, 35: 84.0, 50: 47.0, 85: 29.0, 135: 18.0}
        fov_deg = fov_angles.get(shot.camera_lens_mm, 84.0)
        cone_length = radar_radius * 1.2
        half_fov_rad = math.radians(fov_deg / 2)

        # Assuming camera faces upwards into scene (-90 deg in screen coords)
        p1_x = cam_x - math.sin(half_fov_rad) * cone_length
        p1_y = cam_y - math.cos(half_fov_rad) * cone_length
        p2_x = cam_x + math.sin(half_fov_rad) * cone_length
        p2_y = cam_y - math.cos(half_fov_rad) * cone_length

        # Frustum cone lines
        draw.line([(cam_x, cam_y), (p1_x, p1_y)], fill=(0, 180, 216, 120), width=1)
        draw.line([(cam_x, cam_y), (p2_x, p2_y)], fill=(0, 180, 216, 120), width=1)
        draw.arc(
            [cam_x - cone_length, cam_y - cone_length, cam_x + cone_length, cam_y + cone_length],
            start=-90 - (fov_deg / 2),
            end=-90 + (fov_deg / 2),
            fill=(0, 180, 216),
            width=1,
        )

        # Camera marker
        draw.polygon(
            [(cam_x, cam_y - 12), (cam_x - 10, cam_y + 8), (cam_x + 10, cam_y + 8)],
            fill=(0, 200, 255),
            outline=(255, 255, 255),
        )
        draw.text((cam_x - 30, cam_y + 12), f"CAM {shot.camera_lens_mm}mm", fill=(0, 220, 255), font=font)

        # Draw Subjects & Props
        subject_colors = [(255, 183, 3), (251, 133, 0), (142, 202, 230)]
        subj_idx = 0

        for node in nodes:
            if node.role == "camera":
                continue
            nx, ny = norm_to_radar(node.x, node.y)

            if node.role == "subject":
                col = subject_colors[subj_idx % len(subject_colors)]
                subj_idx += 1
                # Subject circle
                r = 14
                draw.ellipse([nx - r, ny - r, nx + r, ny + r], fill=col, outline=(255, 255, 255), width=2)

                # Facing vector
                rad_face = math.radians(node.facing_deg)
                vec_len = 24
                fx = nx + math.cos(rad_face) * vec_len
                fy = ny - math.sin(rad_face) * vec_len
                draw.line([(nx, ny), (fx, fy)], fill=(255, 255, 255), width=2)

                # Label
                draw.text((nx - 25, ny + r + 3), node.handle, fill=col, font=font)

            elif node.role == "prop":
                # Prop red diamond
                pr = 10
                draw.polygon(
                    [(nx, ny - pr), (nx + pr, ny), (nx, ny + pr), (nx - pr, ny)],
                    fill=(255, 45, 85),
                    outline=(255, 255, 255),
                )
                draw.text((nx - 20, ny + pr + 3), node.handle, fill=(255, 100, 120), font=font)

        # 6. Top Header Banner
        header_y = margin_y + 12
        draw.text(
            (margin_x + 20, header_y),
            "SSRSTUDIO v2 // TECHNICAL ANIMATIC STORYBOARD SLATE // 2.39:1 ANAMORPHIC",
            fill=(0, 210, 255),
            font=font,
        )
        draw.text(
            (self.WIDTH - margin_x - 380, header_y),
            f"PROJECT: {project.title.upper()} [{project.project_id}]",
            fill=(200, 220, 240),
            font=font,
        )

        # 7. Bottom Metadata Overlay Slate Box
        card_x1 = margin_x + 20
        card_y1 = self.HEIGHT - margin_y - 140
        card_x2 = self.WIDTH - margin_x - 20
        card_y2 = self.HEIGHT - margin_y - 15

        draw.rectangle([card_x1, card_y1, card_x2, card_y2], fill=(16, 22, 35), outline=(45, 65, 95), width=2)

        # Col 1: Scene & Shot & Timecode
        start_tc = f"00:00:{(shot.order - 1) * shot.duration_sec:02d}:00"
        end_tc = f"00:00:{shot.order * shot.duration_sec:02d}:00"
        draw.text((card_x1 + 20, card_y1 + 15), f"SCENE: {shot.scene_id.upper()} | SHOT: {shot.order:02d}", fill=(0, 220, 255), font=font)
        draw.text((card_x1 + 20, card_y1 + 40), f"TITLE: {shot.title}", fill=(240, 240, 240), font=font)
        draw.text((card_x1 + 20, card_y1 + 65), f"TC: {start_tc} -> {end_tc} ({shot.duration_sec}s)", fill=(160, 180, 200), font=font)
        draw.text((card_x1 + 20, card_y1 + 90), f"RATIO: 2.39:1 CinemaScope", fill=(100, 140, 180), font=font)

        # Col 2: Optics & Continuity Locks
        col2_x = card_x1 + 460
        draw.text((col2_x, card_y1 + 15), f"LENS: {shot.camera_lens_mm}mm ANAMORPHIC PRIME", fill=(255, 183, 3), font=font)
        draw.text((col2_x, card_y1 + 40), f"MOVE: {shot.camera_move[:45]}", fill=(200, 210, 225), font=font)
        draw.text((col2_x, card_y1 + 65), f"LENS LOCK: {shot.continuity_locks.lens_lock[:45]}...", fill=(140, 160, 185), font=font)
        draw.text((col2_x, card_y1 + 90), f"180° AXIS: {shot.continuity_locks.screen_direction_lock[:45]}", fill=(140, 160, 185), font=font)

        # Col 3: Meisner Action & Dialogue
        col3_x = card_x1 + 1020
        draw.text((col3_x, card_y1 + 15), "MEISNER ACTION & DIALOGUE", fill=(0, 255, 170), font=font)
        draw.text((col3_x, card_y1 + 40), f"STIMULUS: {shot.meisner_stimulus[:60]}...", fill=(200, 220, 230), font=font)
        draw.text((col3_x, card_y1 + 65), f"ACTION: {shot.meisner_micro_action[:60]}...", fill=(200, 220, 230), font=font)
        draw.text((col3_x, card_y1 + 90), f"DIALOGUE: \"{shot.dialogue_line}\"", fill=(255, 255, 255), font=font)

        # Save image
        img.save(str(out_path_obj), "PNG")
        return str(out_path_obj)


# External Provider Stubs
class NanoBananaImageAdapter(BaseImageProvider):
    def generate_image(self, prompt: str, **kwargs: Any) -> str:
        return f"[NanoBanana Image Stub: {prompt[:30]}...]"


class Soul2ImageAdapter(BaseImageProvider):
    def generate_image(self, prompt: str, **kwargs: Any) -> str:
        return f"[Soul2 Portrait Stub: {prompt[:30]}...]"


class SeedanceVideoAdapter(BaseVideoProvider):
    def generate_video(self, prompt: str, **kwargs: Any) -> str:
        return f"[Seedance Video Stub: {prompt[:30]}...]"


class LocalTTSAdapter(BaseTTSProvider):
    def synthesize_speech(self, text: str, **kwargs: Any) -> str:
        return f"[Local TTS Stub: {text[:30]}...]"
