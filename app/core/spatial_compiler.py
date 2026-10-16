import math
from typing import List, Optional
from app.models.project import SpatialNode


def _get_screen_horizontal(x: float) -> str:
    if x < 0.38:
        return "screen-left"
    elif x > 0.62:
        return "screen-right"
    else:
        return "screen-center"


def _get_depth_plane(y: float) -> str:
    if y >= 0.60:
        return "foreground"
    elif y >= 0.35:
        return "midground"
    else:
        return "background"


def _facing_description(deg: float) -> str:
    deg_norm = deg % 360.0
    if 315 <= deg_norm or deg_norm < 45:
        dir_name = "stage-right (0°)"
    elif 45 <= deg_norm < 135:
        dir_name = "camera-forward / downstage (90°)"
    elif 135 <= deg_norm < 225:
        dir_name = "stage-left (180°)"
    else:
        dir_name = "upstage / away from camera (270°)"
    return f"{deg_norm:.0f}° ({dir_name})"


def compile_spatial_blocking(
    nodes: List[SpatialNode],
    lens_mm: int = 35,
    camera_move: str = "Locked-off tripod",
) -> str:
    """
    Deterministically transforms 2D spatial radar nodes and camera settings into
    strict, measurable spatial blocking text for Seedance / Hell Grind prompts.
    Zero hardcoded demo strings.
    """
    if not nodes:
        return (
            f"SPATIAL BLOCKING: Locked camera with {lens_mm}mm prime lens. "
            f"Camera movement: {camera_move}. Subject centered in midground. 180° axis locked."
        )

    cam_node = next((n for n in nodes if n.role == "camera"), None)
    cam_x = cam_node.x if cam_node else 0.50
    cam_y = cam_node.y if cam_node else 0.90

    lines: List[str] = []
    lines.append(f"SPATIAL BLOCKING & RADAR GEOMETRY (Lens: {lens_mm}mm, Camera Move: {camera_move}):")
    lines.append(f"- Camera placement: at {cam_x:.2f}x, {cam_y:.2f}y [{_get_screen_horizontal(cam_x)}, {_get_depth_plane(cam_y)}], 180° camera axis strictly respected.")

    subjects = [n for n in nodes if n.role == "subject"]
    for sub in subjects:
        h_pos = _get_screen_horizontal(sub.x)
        d_plane = _get_depth_plane(sub.y)
        dx = (sub.x - cam_x)
        dy = (sub.y - cam_y)
        dist_m = max(0.8, math.sqrt(dx * dx + dy * dy) * 4.5)
        facing = _facing_description(sub.facing_deg)
        lines.append(
            f"- {sub.handle} position: {h_pos} in the {d_plane} (approx. {dist_m:.1f}m from lens), "
            f"torso and eyeline oriented at {facing}."
        )

    props = [n for n in nodes if n.role == "prop"]
    for p in props:
        h_pos = _get_screen_horizontal(p.x)
        d_plane = _get_depth_plane(p.y)
        lines.append(f"- Prop {p.handle}: positioned at {h_pos} in the {d_plane}.")

    lights = [n for n in nodes if n.role == "light"]
    for lt in lights:
        h_pos = _get_screen_horizontal(lt.x)
        lines.append(f"- Key light {lt.handle}: angled from {h_pos} ({lt.facing_deg:.0f}° vector), creating directional rim lighting.")

    return "\n".join(lines)
