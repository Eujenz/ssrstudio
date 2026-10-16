from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.prompt_compiler import compile_shot_prompts
from app.core.prompt_linter import evaluate_20_point_qa, lint_and_sanitize_prompt
from app.core.rescue_engine import analyze_single_variable_diff, evaluate_stop_loss
from app.core.spatial_compiler import compile_spatial_blocking
from app.core.workspace import WorkspaceManager
from app.models.compiler import (
    CompiledPrompt,
    LintResult,
    QAAuditResult,
    SingleVariableDiffResult,
    StopLossResult,
)
from app.models.project import SpatialNode
from app.api.routes_events import broadcast_event

router = APIRouter(tags=["compiler"])


def get_workspace(request: Request) -> WorkspaceManager:
    return getattr(request.app.state, "workspace_manager", WorkspaceManager())


class LintRequest(BaseModel):
    text: str


class SpatialCompileRequest(BaseModel):
    nodes: List[SpatialNode]
    lens_mm: int = 35
    camera_move: str = "Locked-off tripod"


class RescueRequest(BaseModel):
    prev_prompt: str
    curr_prompt: str
    iteration_count: int = 1
    failure_type: str = "generic_distortion"


@router.post("/api/compiler/lint", response_model=LintResult)
def lint_text(req: LintRequest):
    """Lint text for weak prepositions & abstract emotions."""
    return lint_and_sanitize_prompt(req.text)


@router.post("/api/compiler/spatial")
def compile_spatial(req: SpatialCompileRequest):
    """Compile 2D radar spatial nodes to geometric description."""
    text = compile_spatial_blocking(
        nodes=req.nodes,
        lens_mm=req.lens_mm,
        camera_move=req.camera_move,
    )
    return {"spatial_text": text}


@router.post("/api/projects/{project_id}/shots/{shot_id}/compile")
async def compile_shot(project_id: str, shot_id: str, request: Request):
    """Dynamically compile shot into 10-Section & 15-Block and run 20-point QA."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    shot = next((s for s in project.shots if s.shot_id == shot_id), None)
    if not shot:
        raise HTTPException(status_code=404, detail=f"Shot {shot_id} not found in project {project_id}")

    compiled = compile_shot_prompts(project, shot)
    shot.compiled_10_section = compiled.section_10_text
    shot.compiled_15_block = compiled.block_15_text

    qa = evaluate_20_point_qa(project, shot, compiled)
    shot.qa_passed = qa.passed

    ws.save_project(project)
    ws.log_event(
        project_id,
        "shot_compiled",
        {"shot_id": shot_id, "qa_passed": qa.passed, "qa_score": qa.score},
    )
    await broadcast_event("shot_compiled", {"project_id": project_id, "shot_id": shot_id, "qa_passed": qa.passed})

    return {
        "shot_id": shot_id,
        "compiled": compiled.model_dump(),
        "qa": qa.model_dump(),
    }


@router.post("/api/projects/{project_id}/shots/{shot_id}/rescue")
async def rescue_shot(project_id: str, shot_id: str, req: RescueRequest, request: Request):
    """Analyze single-variable diff and stop-loss recommendation (insert bridge shot if >= 15 iterations)."""
    ws = get_workspace(request)
    if not ws.project_exists(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project = ws.load_project(project_id)
    shot = next((s for s in project.shots if s.shot_id == shot_id), None)
    if not shot:
        raise HTTPException(status_code=404, detail=f"Shot {shot_id} not found in project {project_id}")

    diff_res = analyze_single_variable_diff(req.prev_prompt, req.curr_prompt)
    stop_loss_res = evaluate_stop_loss(req.iteration_count, req.failure_type)

    shot.iteration_count = req.iteration_count
    shot.rescue_history.append({
        "iteration": req.iteration_count,
        "failure_type": req.failure_type,
        "is_single_variable": diff_res.is_single_variable,
        "action": stop_loss_res.action,
        "suggestion": stop_loss_res.bridge_shot_suggestion or stop_loss_res.message,
    })

    ws.save_project(project)
    ws.log_event(
        project_id,
        "rescue_analyzed",
        {
            "shot_id": shot_id,
            "iteration": req.iteration_count,
            "action": stop_loss_res.action,
            "is_single_variable": diff_res.is_single_variable,
        },
    )
    await broadcast_event(
        "rescue_analyzed",
        {"project_id": project_id, "shot_id": shot_id, "action": stop_loss_res.action},
    )

    return {
        "diff": diff_res.model_dump(),
        "stop_loss": stop_loss_res.model_dump(),
    }
