from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CompiledPrompt(BaseModel):
    shot_id: str = ""
    block_15_text: str
    section_10_text: str
    spatial_text: str = ""
    negative_prompt: str = ""
    aspect_ratio: str = "2.39:1"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LintIssue(BaseModel):
    category: str
    word: str
    suggestion: str
    position: Optional[int] = None


class LintResult(BaseModel):
    detected_count: int = 0
    sanitized_text: str
    issues: List[LintIssue] = Field(default_factory=list)
    original_text: str = ""


class QAAuditItem(BaseModel):
    id: str
    name: str
    passed: bool
    detail: str = ""
    remedy: str = ""


class QAAuditResult(BaseModel):
    passed: bool
    score: int = 20  # Total 20 checks
    checks: List[QAAuditItem] = Field(default_factory=list)
    summary: str = ""


class SingleVariableDiffResult(BaseModel):
    is_single_variable: bool
    diff_count: int = 0
    diff_summary: str = ""
    changed_keys: List[str] = Field(default_factory=list)


class StopLossResult(BaseModel):
    iteration_count: int
    action: str  # "CONTINUE", "SIMPLIFY_BLOCKING_OR_REANCHOR", "INSERT_REACTION_BRIDGE_SHOT"
    bridge_shot_suggestion: str = ""
    message: str = ""
