import pytest
from app.models.project import (
    ProjectState,
    StoryFunnel,
    CharacterAsset,
    LocationAsset,
    PropAsset,
    ShotSpec,
    SpatialNode,
    ContinuityLocks,
)
from app.core.spatial_compiler import compile_spatial_blocking
from app.core.prompt_linter import lint_and_sanitize_prompt, evaluate_20_point_qa
from app.core.prompt_compiler import compile_shot_prompts


def test_spatial_compiler_uses_real_coordinates():
    nodes = [
        SpatialNode(id="n1", handle="@elena", role="subject", x=0.22, y=0.72, facing_deg=0),
        SpatialNode(id="n2", handle="@drone_boss", role="subject", x=0.78, y=0.25, facing_deg=180),
        SpatialNode(id="cam", handle="@cam_a", role="camera", x=0.50, y=0.90, facing_deg=270),
    ]
    text = compile_spatial_blocking(nodes, lens_mm=85, camera_move="Locked-off tripod")
    assert "@elena" in text
    assert "@drone_boss" in text
    assert "@roco" not in text  # 絕不可出現寫死的舊角色
    assert "screen-left" in text.lower()
    assert "foreground" in text.lower()
    assert "screen-right" in text.lower()
    assert "background" in text.lower()
    assert "85mm" in text


def test_spatial_compiler_handles_center_and_midground():
    nodes = [
        SpatialNode(id="n1", handle="@hero", role="subject", x=0.50, y=0.50, facing_deg=90),
    ]
    text = compile_spatial_blocking(nodes, lens_mm=35, camera_move="Dolly-in")
    assert "@hero" in text
    assert "screen-center" in text.lower()
    assert "midground" in text.lower()
    assert "35mm" in text


def test_linter_catches_weak_words_and_emotions():
    raw = "Camera stands near the door, next to @elena who feels sad and angry."
    res = lint_and_sanitize_prompt(raw)
    assert res.detected_count >= 3
    assert "near" not in res.sanitized_text.lower()
    assert "sad" not in res.sanitized_text.lower()
    assert "angry" not in res.sanitized_text.lower()
    assert len(res.issues) >= 3


def test_dynamic_15_block_and_10_section_compiler():
    proj = ProjectState(
        project_id="proj-test",
        title="Cyber Heist",
        idea="駭客潛入量子金庫",
        funnel=StoryFunnel(
            genre_tone="Neo-Noir Cyberpunk Thriller",
            world_reality="Rain-slicked Tokyo mega-vault in 2089",
            core_conflict="@elena must bypass the laser grid before @warden arrives",
            protagonist_arc="From panicked rookie to cold tactician",
            visual_motif="High-contrast cyan laser beams cutting through wet concrete",
            aspect_ratio="2.39:1",
        ),
        characters=[
            CharacterAsset(
                handle="@elena",
                name="Elena Vance",
                wardrobe_lock="matte black tactical raincoat with silver circuit seams",
                voice_lock="Measured alto voice, crisp consonant articulation, slight vocal fry",
            )
        ],
        locations=[
            LocationAsset(
                handle="@quantum_vault",
                name="Sub-level 9 Quantum Vault",
                lighting_lock="Overhead cold 5600K strip lights + sweeping red laser grid",
                architecture_lock="Brutalist obsidian pillars and wet grated steel floor",
            )
        ],
        props=[
            PropAsset(
                handle="@decryptor",
                name="Quantum Decryptor",
                material_lock="Brushed brass casing with glowing amber nixie tubes",
            )
        ],
        shots=[
            ShotSpec(
                shot_id="shot-01",
                scene_id="sc-01",
                order=1,
                title="Vault Entry",
                duration_sec=10,
                camera_lens_mm=35,
                camera_move="Slow dolly-in along floor grate",
                spatial_nodes=[
                    SpatialNode(id="s1", handle="@elena", role="subject", x=0.3, y=0.6, facing_deg=45)
                ],
                meisner_stimulus="Red laser beam slices 2cm past her left cheek",
                meisner_micro_action="Pupils dilate, jaw clenches, right thumb clicks the brass decryptor switch twice",
                dialogue_line="We have twelve seconds.",
                continuity_locks=ContinuityLocks(
                    first_frame_lock="@elena crouched at screen-left behind obsidian pillar",
                    screen_direction_lock="@elena faces screen-right throughout",
                    lens_lock="35mm anamorphic prime, no focal length shifts",
                    count_lock="Exactly 1 human character (@elena) in frame",
                    stillness_lock="Obsidian pillars and steel floor grates remain rigid",
                    monotonic_state_notes="Rain droplets on raincoat collar persist without drying",
                ),
            )
        ],
    )
    compiled = compile_shot_prompts(proj, proj.shots[0])
    assert "[01/15]" in compiled.block_15_text
    assert "[15/15]" in compiled.block_15_text
    assert "@elena" in compiled.block_15_text
    assert "@quantum_vault" in compiled.block_15_text
    assert "@roco" not in compiled.block_15_text
    assert "GLOBAL STYLE:" in compiled.section_10_text
    assert "FIRST FRAME AND SPATIAL BLOCKING:" in compiled.section_10_text
    assert "SCREEN DIRECTION:" in compiled.section_10_text

    qa = evaluate_20_point_qa(proj, proj.shots[0], compiled)
    assert qa.passed is True
    assert qa.score == 20
    assert len(qa.checks) == 20
    assert all(c.passed for c in qa.checks)


def test_qa_audit_catches_flaws():
    proj = ProjectState(
        project_id="proj-flawed",
        title="Flawed Project",
        characters=[CharacterAsset(handle="@elena", name="Elena")],
        locations=[LocationAsset(handle="@hall", name="Hall")],
        shots=[
            ShotSpec(
                shot_id="shot-02",
                title="Flawed Shot",
                dialogue_line="",
                spatial_nodes=[],
                meisner_stimulus="",
                meisner_micro_action="",
                continuity_locks=ContinuityLocks(
                    first_frame_lock="",
                    screen_direction_lock="",
                    lens_lock="",
                    count_lock="",
                    stillness_lock="",
                ),
            )
        ],
    )
    compiled = compile_shot_prompts(proj, proj.shots[0])
    qa = evaluate_20_point_qa(proj, proj.shots[0], compiled)
    assert qa.passed is False
    assert qa.score < 20
    failing_checks = [c for c in qa.checks if not c.passed]
    assert len(failing_checks) > 0
    # Every failing check has a remedy suggestion
    for f in failing_checks:
        assert len(f.remedy) > 0
