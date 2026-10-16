from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.workspace import WorkspaceManager
from app.models.project import ProjectState, ShotSpec
from app.services.llm_director import GuidedDirectorService
from app.services.media_providers import LocalAnimaticProvider
from app.api.routes_events import broadcast_event

router = APIRouter(tags=["wizard"])


def get_workspace(request: Request) -> WorkspaceManager:
    return getattr(request.app.state, "workspace_manager", WorkspaceManager())


class WizardBootstrapRequest(BaseModel):
    title: str
    idea: str
    shot_count: int = 3
    style_preset: str = "hell_grind_anamorphic"


@router.post("/api/wizard/bootstrap", response_model=ProjectState)
async def wizard_bootstrap(req: WizardBootstrapRequest, request: Request):
    """Guided creation endpoint. Takes {title, idea, shot_count, style_preset},
    calls GuidedDirectorService, creates project in workspace, and renders initial animatic slates.
    """
    ws = get_workspace(request)
    director = GuidedDirectorService()
    animatic_provider = LocalAnimaticProvider()

    # 1. Generate full project state via Guided Director
    project = director.bootstrap_from_idea(
        title=req.title,
        idea=req.idea,
        shot_count=req.shot_count,
        style_preset=req.style_preset,
    )

    # 2. Persist project in workspace
    # Save project state
    ws.save_project(project)
    ws.log_event(project.project_id, "wizard_bootstrapped", {"title": req.title, "shot_count": req.shot_count})

    # 3. Render initial animatic slates for all generated shots
    renders_dir = ws.get_project_dir(project.project_id) / "renders"
    renders_dir.mkdir(parents=True, exist_ok=True)

    for shot in project.shots:
        slate_path = renders_dir / f"{shot.shot_id}_slate.png"
        animatic_provider.render_shot_slate(project, shot, slate_path)
        shot.animatic_slate_path = str(slate_path)

    # Save project again with updated animatic slate paths
    ws.save_project(project)

    await broadcast_event(
        "wizard_bootstrapped",
        {"project_id": project.project_id, "title": project.title, "shots": len(project.shots)},
    )

    return project


@router.post("/api/projects/{project_id}/shots/{shot_id}/auto-fix", response_model=ShotSpec)
async def auto_fix_shot(project_id: str, shot_id: str, request: Request):
    """AI auto-fix shot QA endpoint. Enforces Meisner stimulus, micro-actions,
    continuity locks, and sanitizes unknown entity handles.
    """
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    target_shot = next((s for s in project.shots if s.shot_id == shot_id), None)
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Shot {shot_id} not found in project {project_id}")

    director = GuidedDirectorService()
    fixed_shot = director.auto_fix_shot_qa(project, target_shot)

    # Update in project and save
    ws.save_project(project)
    ws.log_event(project_id, "shot_auto_fixed", {"shot_id": shot_id, "qa_passed": fixed_shot.qa_passed})
    await broadcast_event("shot_auto_fixed", {"project_id": project_id, "shot_id": shot_id, "qa_passed": fixed_shot.qa_passed})

    return fixed_shot
