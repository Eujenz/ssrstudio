import pytest
from pathlib import Path
from app.models.project import (
    ProjectState,
    StoryFunnel,
    ShotSpec,
    SpatialNode,
    ApprovalGateStatus,
    CharacterAsset,
    LocationAsset,
    PropAsset,
    ContinuityLocks,
)
from app.models.compiler import (
    CompiledPrompt,
    LintIssue,
    LintResult,
    QAAuditItem,
    QAAuditResult,
    SingleVariableDiffResult,
    StopLossResult,
)
from app.core.workspace import WorkspaceManager
from app.core.tool_registry import ToolRegistry


def test_create_and_load_project(tmp_path: Path):
    ws = WorkspaceManager(base_dir=tmp_path)
    proj = ws.create_project(
        title="Hell Grind Demo",
        idea="一名拳擊手在地下鐵籠面對機械改造宗師的最後一戰",
    )
    assert proj.project_id.startswith("proj-")
    assert (tmp_path / proj.project_id / "project.json").exists()
    assert len(proj.shots) >= 1

    # 測試更新 Gate 狀態並儲存 Checkpoint
    loaded = ws.update_gate(proj.project_id, "story_funnel", ApprovalGateStatus.APPROVED)
    assert loaded.gates["story_funnel"] == ApprovalGateStatus.APPROVED
    checkpoints = list((tmp_path / proj.project_id / "checkpoints").glob("*.json"))
    assert len(checkpoints) >= 1

    # 測試載入現有專案
    reloaded = ws.load_project(proj.project_id)
    assert reloaded.title == "Hell Grind Demo"
    assert reloaded.gates["story_funnel"] == ApprovalGateStatus.APPROVED

    # 測試儲存專案與列出專案
    reloaded.title = "Hell Grind Demo Updated"
    ws.save_project(reloaded)
    listed = ws.list_projects()
    assert any(p["project_id"] == proj.project_id and p["title"] == "Hell Grind Demo Updated" for p in listed)

    # 測試事件日誌追加
    event = ws.log_event(proj.project_id, event_type="gate_approved", data={"gate": "story_funnel"})
    events_file = tmp_path / proj.project_id / "artifacts" / "events.jsonl"
    assert events_file.exists()
    assert "gate_approved" in events_file.read_text(encoding="utf-8")


def test_tool_registry_pluggable_specs():
    registry = ToolRegistry()
    video_tools = registry.list_tools(category="video_generation")
    assert any(t["id"] == "seedance_2_5" for t in video_tools)
    assert any(t["id"] == "local_animatic_slate" and t["mode"] == "local_active" for t in video_tools)
    image_tools = registry.list_tools(category="image_generation")
    assert any(t["id"] == "nano_banana_pro" for t in image_tools)

    director_tools = registry.list_tools(category="director")
    assert any(t["id"] == "local_deterministic_director" and t["mode"] == "local_active" for t in director_tools)

    # 驗證所有要求的 stub 工具存在
    required_stubs = [
        "nano_banana_pro",
        "soul_2_0",
        "seedream_4_5",
        "seedance_2_5",
        "seedance_2_0",
        "elevenlabs_tts",
    ]
    for stub_id in required_stubs:
        tool = registry.get_tool(stub_id)
        assert tool is not None, f"Missing tool stub: {stub_id}"
        assert tool["mode"] == "adapter_stub_ready"

    # 測試自訂 adapter 註冊
    registry.register_adapter(
        tool_id="custom_kling_v1",
        name="Custom Kling Video Provider",
        category="video_generation",
        mode="adapter_stub_ready",
        metadata={"version": "1.0"},
    )
    custom = registry.get_tool("custom_kling_v1")
    assert custom["name"] == "Custom Kling Video Provider"


def test_project_models_validation():
    node = SpatialNode(id="n1", handle="@roco", role="subject", x=0.2, y=0.8, facing_deg=90.0)
    assert node.x == 0.2
    assert node.facing_deg == 90.0

    locks = ContinuityLocks(
        first_frame_lock="First frame locked",
        screen_direction_lock="Screen left to right",
        lens_lock="35mm anamorphic prime",
        count_lock="Exactly 1 character",
        stillness_lock="Background static",
        monotonic_state_notes="Blood on left cheek increases",
    )
    assert locks.count_lock == "Exactly 1 character"

    shot = ShotSpec(
        shot_id="shot-01",
        scene_id="scene-01",
        order=1,
        title="Opening Hook",
        duration_sec=10,
        camera_lens_mm=35,
        camera_move="dolly-in",
        spatial_nodes=[node],
        meisner_stimulus="Bell rings",
        meisner_micro_action="Takes deep breath",
        dialogue_line="Ready.",
        continuity_locks=locks,
    )
    assert shot.duration_sec == 10
    assert shot.camera_lens_mm == 35


def test_compiler_models():
    compiled = CompiledPrompt(
        shot_id="shot-01",
        block_15_text="[01/15] GLOBAL STYLE...",
        section_10_text="GLOBAL STYLE: ...",
        spatial_text="@roco at screen-left",
    )
    assert "[01/15]" in compiled.block_15_text

    qa = QAAuditResult(
        passed=True,
        score=20,
        checks=[QAAuditItem(id="check-1", name="Lens lock specified", passed=True)],
    )
    assert qa.passed is True
    assert qa.score == 20
