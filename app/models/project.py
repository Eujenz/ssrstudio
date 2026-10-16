from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ApprovalGateStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class StoryFunnel(BaseModel):
    genre_tone: str = "Cinematic Neo-Noir"
    world_reality: str = "High-contrast urban dystopia"
    core_conflict: str = "Protagonist against overwhelming corporate system"
    protagonist_arc: str = "Disillusioned survivor regaining purpose"
    visual_motif: str = "Reflective rain, sharp tungsten rim lighting against cyan haze"
    aspect_ratio: str = "2.39:1"
    target_duration_sec: int = 30


class CharacterAsset(BaseModel):
    handle: str  # e.g. "@roco"
    name: str
    wardrobe_lock: str = ""
    voice_lock: str = ""  # 逐字發音錨點字串
    turnaround_image: Optional[str] = None
    headless_sheet_image: Optional[str] = None
    closeup_images: List[str] = Field(default_factory=list)


class LocationAsset(BaseModel):
    handle: str  # e.g. "@underground_gym"
    name: str
    lighting_lock: str = ""
    architecture_lock: str = ""
    reference_images: List[str] = Field(default_factory=list)


class PropAsset(BaseModel):
    handle: str  # e.g. "@dagger"
    name: str
    material_lock: str = ""
    contact_sheet_image: Optional[str] = None


class SpatialNode(BaseModel):
    id: str
    handle: str
    role: Literal["subject", "camera", "light", "prop"] = "subject"
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    facing_deg: float = Field(default=0.0, ge=0.0, le=360.0)


class ContinuityLocks(BaseModel):
    first_frame_lock: str = ""
    screen_direction_lock: str = ""
    lens_lock: str = ""
    count_lock: str = ""
    stillness_lock: str = ""
    monotonic_state_notes: str = ""


class ShotSpec(BaseModel):
    shot_id: str
    scene_id: str = "scene-01"
    order: int = 1
    title: str = "Shot Title"
    duration_sec: int = 10  # 5, 10, or 15
    camera_lens_mm: int = 35  # 24, 35, 50, 85, 135
    camera_move: str = "Locked-off tripod"
    spatial_nodes: List[SpatialNode] = Field(default_factory=list)
    meisner_stimulus: str = ""
    meisner_micro_action: str = ""
    dialogue_line: str = ""
    continuity_locks: ContinuityLocks = Field(default_factory=ContinuityLocks)
    precomp_image_path: Optional[str] = None
    animatic_slate_path: Optional[str] = None
    animatic_Drop_path: Optional[str] = None
    compiled_10_section: str = ""
    compiled_15_block: str = ""
    qa_passed: bool = False
    iteration_count: int = 0
    rescue_history: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "draft"  # draft, approved, rejected, rendering, done


def default_gates() -> Dict[str, ApprovalGateStatus]:
    return {
        "story_funnel": ApprovalGateStatus.PENDING,
        "asset_bible": ApprovalGateStatus.PENDING,
        "storyboard_blocking": ApprovalGateStatus.PENDING,
        "final_render": ApprovalGateStatus.PENDING,
    }


class ProjectState(BaseModel):
    project_id: str
    title: str
    idea: str = ""
    funnel: StoryFunnel = Field(default_factory=StoryFunnel)
    characters: List[CharacterAsset] = Field(default_factory=list)
    locations: List[LocationAsset] = Field(default_factory=list)
    props: List[PropAsset] = Field(default_factory=list)
    shots: List[ShotSpec] = Field(default_factory=list)
    gates: Dict[str, ApprovalGateStatus] = Field(default_factory=default_gates)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
