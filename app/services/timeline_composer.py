from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.project import ProjectState, ShotSpec


class TimelineClip(BaseModel):
    shot_id: str
    order: int
    duration_sec: int
    video_path: Optional[str] = None
    audio_path: Optional[str] = None
    dialogue_line: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TimelineManifest(BaseModel):
    project_id: str
    title: str
    aspect_ratio: str = "2.39:1"
    total_shots: int
    total_duration_sec: int
    clips: List[TimelineClip] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TimelineComposer:
    """Timeline Assembly and FFmpeg Concat Generator for SSRStudio v2.

    Assembles shot sequences, computes J/L-cut audio offsets, generates timeline manifests,
    and produces FFmpeg scripts for stitching animatic slates or rendered video clips
    into a continuous 2.39:1 cinema preview.
    """

    def __init__(self) -> None:
        pass

    def compile_timeline_manifest(self, project: ProjectState) -> TimelineManifest:
        """Compiles timeline manifest from approved or active project shots."""
        sorted_shots = sorted(project.shots, key=lambda s: s.order)
        clips: List[TimelineClip] = []
        total_duration = 0

        for idx, shot in enumerate(sorted_shots):
            total_duration += shot.duration_sec

            # Compute J/L-cut audio offsets for cinematic natural sound overlap
            # Shot 1: Normal onset (0.0s)
            # Shot 2: J-cut (audio precedes visual cut by -0.25s)
            # Shot 3: L-cut (audio lingers past cut by +0.30s)
            if idx == 0:
                audio_offset = 0.0
                cut_type = "hard_cut"
            elif idx % 2 == 1:
                audio_offset = -0.25  # J-cut
                cut_type = "j_cut_pre_overlap"
            else:
                audio_offset = 0.30   # L-cut
                cut_type = "l_cut_post_bleed"

            clip = TimelineClip(
                shot_id=shot.shot_id,
                order=shot.order,
                duration_sec=shot.duration_sec,
                video_path=shot.animatic_slate_path or shot.precomp_image_path,
                dialogue_line=shot.dialogue_line,
                metadata={
                    "lens_mm": shot.camera_lens_mm,
                    "audio_offset_sec": audio_offset,
                    "transition": cut_type,
                    "stillness_lock": shot.continuity_locks.stillness_lock,
                    "screen_direction": shot.continuity_locks.screen_direction_lock,
                },
            )
            clips.append(clip)

        return TimelineManifest(
            project_id=project.project_id,
            title=project.title,
            aspect_ratio=project.funnel.aspect_ratio or "2.39:1",
            total_shots=len(clips),
            total_duration_sec=total_duration,
            clips=clips,
        )

    def generate_ffmpeg_concat_script(
        self,
        project: ProjectState,
        manifest: TimelineManifest,
        output_path: str = "renders/preview_239.mp4",
        concat_txt_path: Optional[str] = None,
    ) -> str:
        """Generates an executable FFmpeg concat command string and demographic list for preview assembly."""
        txt_path = concat_txt_path or f"renders/{project.project_id}_concat.txt"

        # Concat demuxer command for 2.39:1 (1920x804) anamorphic output
        ffmpeg_cmd = (
            f"ffmpeg -y -f concat -safe 0 -i \"{txt_path}\" "
            f"-vf \"scale=1920:804:force_original_aspect_ratio=decrease,pad=1920:804:(ow-iw)/2:(oh-ih)/2,setsar=1\" "
            f"-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 24 \"{output_path}\""
        )
        return ffmpeg_cmd

    def write_concat_file_content(self, manifest: TimelineManifest) -> str:
        """Returns the content for FFmpeg concat demuxer text file."""
        lines = []
        for clip in manifest.clips:
            clip_path = clip.video_path or f"renders/{clip.shot_id}_slate.png"
            lines.append(f"file '{clip_path}'")
            lines.append(f"duration {clip.duration_sec}")
        # Trailing file entry required by ffmpeg concat demuxer
        if manifest.clips:
            last_clip_path = manifest.clips[-1].video_path or f"renders/{manifest.clips[-1].shot_id}_slate.png"
            lines.append(f"file '{last_clip_path}'")
        return "\n".join(lines)
