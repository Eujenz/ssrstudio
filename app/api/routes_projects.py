from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.workspace import WorkspaceManager
from app.models.project import (
    ApprovalGateStatus,
    CharacterAsset,
    ContinuityLocks,
    LocationAsset,
    ProjectState,
    PropAsset,
    ShotSpec,
    SpatialNode,
    StoryFunnel,
)
from app.services.media_providers import LocalAnimaticProvider
from app.services.timeline_composer import TimelineComposer
from app.api.routes_events import broadcast_event

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_workspace(request: Request) -> WorkspaceManager:
    return getattr(request.app.state, "workspace_manager", WorkspaceManager())


class CreateProjectRequest(BaseModel):
    title: str
    idea: str = ""
    funnel: Optional[StoryFunnel] = None
    shots: Optional[List[ShotSpec]] = None


class ProjectUpdateRequest(BaseModel):
    title: Optional[str] = None
    idea: Optional[str] = None
    funnel: Optional[StoryFunnel] = None
    characters: Optional[List[CharacterAsset]] = None
    locations: Optional[List[LocationAsset]] = None
    props: Optional[List[PropAsset]] = None


class GateUpdateRequest(BaseModel):
    status: ApprovalGateStatus
    notes: str = ""


class ShotUpdateRequest(BaseModel):
    title: Optional[str] = None
    duration_sec: Optional[int] = None
    camera_lens_mm: Optional[int] = None
    camera_move: Optional[str] = None
    spatial_nodes: Optional[List[SpatialNode]] = None
    meisner_stimulus: Optional[str] = None
    meisner_micro_action: Optional[str] = None
    dialogue_line: Optional[str] = None
    continuity_locks: Optional[ContinuityLocks] = None
    status: Optional[str] = None


@router.get("")
def list_projects(request: Request):
    """List all projects in the workspace."""
    ws = get_workspace(request)
    return ws.list_projects()


@router.post("", response_model=ProjectState)
async def create_project(req: CreateProjectRequest, request: Request):
    """Create a new project in the workspace."""
    ws = get_workspace(request)
    proj = ws.create_project(
        title=req.title,
        idea=req.idea,
        funnel=req.funnel,
        shots=req.shots,
    )
    await broadcast_event("project_created", {"project_id": proj.project_id, "title": proj.title})
    return proj


@router.get("/{project_id}", response_model=ProjectState)
def get_project(project_id: str, request: Request):
    """Get project state by project ID."""
    ws = get_workspace(request)
    try:
        return ws.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.put("/{project_id}", response_model=ProjectState)
async def update_project(project_id: str, req: ProjectUpdateRequest, request: Request):
    """Update project funnel, characters, locations, or props."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    if req.title is not None:
        project.title = req.title
    if req.idea is not None:
        project.idea = req.idea
    if req.funnel is not None:
        project.funnel = req.funnel
    if req.characters is not None:
        project.characters = req.characters
    if req.locations is not None:
        project.locations = req.locations
    if req.props is not None:
        project.props = req.props

    ws.save_project(project)
    ws.log_event(project_id, "project_updated", {"project_id": project_id})
    await broadcast_event("project_updated", {"project_id": project_id})
    return project


@router.post("/{project_id}/gates/{gate_name}", response_model=ProjectState)
async def update_gate(project_id: str, gate_name: str, req: GateUpdateRequest, request: Request):
    """Update approval gate status and create a timestamped checkpoint."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    try:
        updated_project = ws.update_gate(
            project_id=project_id,
            gate_name=gate_name,
            status=req.status,
            reason=req.notes,
        )
        await broadcast_event(
            "gate_updated",
            {
                "project_id": project_id,
                "gate": gate_name,
                "status": req.status.value if hasattr(req.status, "value") else str(req.status),
                "notes": req.notes,
            },
        )
        return updated_project
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{project_id}/shots/{shot_id}", response_model=ShotSpec)
async def update_shot(project_id: str, shot_id: str, req: ShotUpdateRequest, request: Request):
    """Update shot specifications (spatial nodes, lens, meisner, continuity locks)."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    target_shot = next((s for s in project.shots if s.shot_id == shot_id), None)
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Shot {shot_id} not found in project {project_id}")

    # Partial update attributes
    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            if field == "spatial_nodes":
                target_shot.spatial_nodes = [SpatialNode(**n) if isinstance(n, dict) else n for n in val]
            elif field == "continuity_locks":
                target_shot.continuity_locks = ContinuityLocks(**val) if isinstance(val, dict) else val
            else:
                setattr(target_shot, field, val)

    ws.save_project(project)
    ws.log_event(project_id, "shot_updated", {"shot_id": shot_id, "updates": list(update_data.keys())})
    await broadcast_event("shot_updated", {"project_id": project_id, "shot_id": shot_id})
    return target_shot


@router.post("/{project_id}/shots/{shot_id}/render-animatic")
async def render_animatic(project_id: str, shot_id: str, request: Request):
    """Render local 2.39:1 technical animatic slate PNG for the shot."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    shot = next((s for s in project.shots if s.shot_id == shot_id), None)
    if not shot:
        raise HTTPException(status_code=404, detail=f"Shot {shot_id} not found in project {project_id}")

    provider = LocalAnimaticProvider()
    slate_path = ws.get_project_dir(project_id) / "renders" / f"{shot_id}_slate.png"
    provider.render_shot_slate(project, shot, slate_path)

    shot.animatic_slate_path = str(slate_path)
    ws.save_project(project)
    ws.log_event(project_id, "animatic_rendered", {"shot_id": shot_id, "path": str(slate_path)})
    await broadcast_event("animatic_rendered", {"project_id": project_id, "shot_id": shot_id, "path": str(slate_path)})

    return {
        "status": "rendered",
        "shot_id": shot_id,
        "slate_path": str(slate_path),
        "relative_url": f"/projects/{project_id}/renders/{shot_id}_slate.png",
    }


@router.post("/{project_id}/timeline")
async def generate_timeline(project_id: str, request: Request):
    """Generate timeline manifest and FFmpeg concat script."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    composer = TimelineComposer()
    manifest = composer.compile_timeline_manifest(project)

    concat_txt_path = ws.get_project_dir(project_id) / "renders" / f"{project_id}_concat.txt"
    concat_txt_path.parent.mkdir(parents=True, exist_ok=True)
    concat_content = composer.write_concat_file_content(manifest)
    concat_txt_path.write_text(concat_content, encoding="utf-8")

    out_mp4 = ws.get_project_dir(project_id) / "renders" / f"{project_id}_preview.mp4"
    ffmpeg_cmd = composer.generate_ffmpeg_concat_script(
        project,
        manifest,
        output_path=str(out_mp4),
        concat_txt_path=str(concat_txt_path),
    )

    ws.log_event(project_id, "timeline_generated", {"total_shots": manifest.total_shots, "duration": manifest.total_duration_sec})
    await broadcast_event("timeline_generated", {"project_id": project_id, "total_shots": manifest.total_shots})

    return {
        "manifest": manifest.model_dump(),
        "concat_file": str(concat_txt_path),
        "ffmpeg_command": ffmpeg_cmd,
    }
