import os
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from PIL import Image

from app.main import create_app


def test_api_workflow_end_to_end(tmp_path: Path):
    app = create_app(projects_dir=tmp_path)
    client = TestClient(app)

    # 1. Health & tools endpoints
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"

    tools_res = client.get("/api/tools")
    assert tools_res.status_code == 200
    tools_data = tools_res.json()
    assert isinstance(tools_data, list)
    assert any(t["id"] == "local_deterministic_director" for t in tools_data)
    assert any(t["id"] == "local_animatic_slate" for t in tools_data)

    # 2. Wizard bootstrap
    res = client.post("/api/wizard/bootstrap", json={
        "title": "Hell Grind Arena",
        "idea": "地下拳手 Roco 在鐵籠中迎戰機械宗師 Kane，爭奪最後的自由通行證",
        "shot_count": 3,
        "style_preset": "hell_grind_anamorphic"
    })
    assert res.status_code == 200
    proj = res.json()
    project_id = proj["project_id"]
    assert len(proj["shots"]) == 3
    assert len(proj["characters"]) >= 2
    assert len(proj["locations"]) >= 1

    # Check that initial animatic slates were generated
    for shot in proj["shots"]:
        assert shot["animatic_slate_path"] is not None
        assert Path(shot["animatic_slate_path"]).exists()

    # 3. List projects & Get project state
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    proj_list = list_res.json()
    assert any(p["project_id"] == project_id for p in proj_list)

    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["project_id"] == project_id

    # 4. Compile shot & 20-point QA
    shot_0 = proj["shots"][0]
    shot_id = shot_0["shot_id"]
    comp_res = client.post(f"/api/projects/{project_id}/shots/{shot_id}/compile")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["qa"]["passed"] is True
    assert comp_data["qa"]["score"] == 20
    assert "GLOBAL STYLE:" in comp_data["compiled"]["section_10_text"]
    assert "[01/15]" in comp_data["compiled"]["block_15_text"]

    # 5. Spatial blocking compilation endpoint
    spatial_res = client.post("/api/compiler/spatial", json={
        "nodes": [
            {"id": "n1", "handle": "@roco", "role": "subject", "x": 0.25, "y": 0.70, "facing_deg": 45.0},
            {"id": "cam", "handle": "camera", "role": "camera", "x": 0.50, "y": 0.90, "facing_deg": 270.0}
        ],
        "lens_mm": 50,
        "camera_move": "Locked-off tripod"
    })
    assert spatial_res.status_code == 200
    spatial_data = spatial_res.json()
    assert "@roco" in spatial_data["spatial_text"]
    assert "50mm" in spatial_data["spatial_text"]

    # 6. Linter endpoint (weak prepositions and abstract emotions)
    lint_res = client.post("/api/compiler/lint", json={
        "text": "@roco stands near the cage and feels angry beside Kane."
    })
    assert lint_res.status_code == 200
    lint_data = lint_res.json()
    assert lint_data["detected_count"] >= 3
    assert "near" not in lint_data["sanitized_text"].lower()
    assert "angry" not in lint_data["sanitized_text"].lower()

    # 7. Update shot spec (spatial nodes, lens, etc.)
    update_shot_res = client.put(f"/api/projects/{project_id}/shots/{shot_id}", json={
        "camera_lens_mm": 85,
        "camera_move": "Slow push-in dolly",
        "spatial_nodes": [
            {"id": "n1", "handle": "@roco", "role": "subject", "x": 0.30, "y": 0.65, "facing_deg": 0.0}
        ]
    })
    assert update_shot_res.status_code == 200
    updated_shot = update_shot_res.json()
    assert updated_shot["camera_lens_mm"] == 85
    assert updated_shot["camera_move"] == "Slow push-in dolly"

    # 8. Render local animatic slate endpoint
    render_slate_res = client.post(f"/api/projects/{project_id}/shots/{shot_id}/render-animatic")
    assert render_slate_res.status_code == 200
    slate_data = render_slate_res.json()
    assert Path(slate_data["slate_path"]).exists()

    # 9. Auto-fix shot QA endpoint
    # Intentionally corrupt a shot with unknown handle or missing locks
    client.put(f"/api/projects/{project_id}/shots/{shot_id}", json={
        "title": "Corrupted @ghost_character",
        "continuity_locks": {
            "first_frame_lock": "",
            "stillness_lock": ""
        }
    })
    autofix_res = client.post(f"/api/projects/{project_id}/shots/{shot_id}/auto-fix")
    assert autofix_res.status_code == 200
    fixed_shot = autofix_res.json()
    assert fixed_shot["qa_passed"] is True

    # 10. Single-variable rescue endpoint
    # Test stop loss evaluation
    rescue_res = client.post(f"/api/projects/{project_id}/shots/{shot_id}/rescue", json={
        "prev_prompt": "35mm anamorphic prime. @roco sprints forward.",
        "curr_prompt": "50mm anamorphic prime. @roco sprints forward.",
        "iteration_count": 15,
        "failure_type": "physics_collapse"
    })
    assert rescue_res.status_code == 200
    rescue_data = rescue_res.json()
    assert rescue_data["diff"]["is_single_variable"] is True
    assert rescue_data["stop_loss"]["action"] == "INSERT_REACTION_BRIDGE_SHOT"

    # 11. Approval gates endpoint
    gate_res = client.post(f"/api/projects/{project_id}/gates/story_funnel", json={
        "status": "approved",
        "notes": "故事漏斗結構清晰，准許進入資產鎖定階段"
    })
    assert gate_res.status_code == 200
    assert gate_res.json()["gates"]["story_funnel"] == "approved"

    # 12. Asset operations: headless-crop and contact-sheet
    # Create a test image
    test_turnaround = tmp_path / "turnaround.png"
    Image.new("RGB", (600, 500), color=(50, 60, 70)).save(test_turnaround)
    dest_cropped = tmp_path / "cropped_headless.png"

    crop_res = client.post("/api/assets/headless-crop", json={
        "src_path": str(test_turnaround),
        "dest_path": str(dest_cropped),
        "top_crop_ratio": 0.22
    })
    assert crop_res.status_code == 200
    assert dest_cropped.exists()

    # Red-arrow contact sheet
    dest_contact = tmp_path / "contact_arrow.png"
    contact_res = client.post("/api/assets/contact-sheet", json={
        "base_img_path": str(test_turnaround),
        "out_img_path": str(dest_contact),
        "arrows": [{"x1": 50, "y1": 50, "x2": 200, "y2": 150, "label": "GRIP"}]
    })
    assert contact_res.status_code == 200
    assert dest_contact.exists()

    # 13. Timeline manifest & FFmpeg script generation endpoint
    tl_res = client.post(f"/api/projects/{project_id}/timeline")
    assert tl_res.status_code == 200
    tl_data = tl_res.json()
    assert tl_data["manifest"]["total_shots"] == 3
    assert "ffmpeg" in tl_data["ffmpeg_command"]
    assert tl_data["manifest"]["project_id"] == project_id

    # 14. Update project funnel and assets via PUT /api/projects/{project_id}
    put_proj_res = client.put(f"/api/projects/{project_id}", json={
        "funnel": {
            "genre_tone": "Cyberpunk Neo-Noir 2.39:1",
            "world_reality": "High-gravity rain-slicked industrial sector",
            "core_conflict": "Escape before lockdown",
            "protagonist_arc": "From defensive hesitation to decisive counter-strike",
            "visual_motif": "Sodium vapor orange against cyan neon reflections"
        }
    })
    assert put_proj_res.status_code == 200
    assert put_proj_res.json()["funnel"]["genre_tone"] == "Cyberpunk Neo-Noir 2.39:1"

    # 15. One-click schematic headless cropper without src_path
    auto_crop_dest = tmp_path / "schematic_headless.png"
    auto_crop_res = client.post("/api/assets/headless-crop", json={
        "out_path": str(auto_crop_dest),
        "crop_top_ratio": 0.22,
        "character_handle": "@roco"
    })
    assert auto_crop_res.status_code == 200
    assert auto_crop_dest.exists()

