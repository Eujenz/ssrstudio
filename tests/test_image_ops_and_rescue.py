import pytest
from pathlib import Path
from PIL import Image

from app.core.image_ops import create_headless_character_sheet, render_red_arrow_contact_sheet
from app.core.rescue_engine import analyze_single_variable_diff, evaluate_stop_loss


def test_headless_crop_removes_top_head_region(tmp_path: Path):
    src = tmp_path / "full_turnaround.png"
    img = Image.new("RGB", (1200, 1000), color=(40, 50, 60))
    img.save(src)

    out = tmp_path / "headless_sheet.png"
    meta = create_headless_character_sheet(src, out, top_crop_ratio=0.22)
    assert out.exists()
    cropped = Image.open(out)
    assert cropped.size == (1200, 780)
    assert meta["cropped_top_px"] == 220
    assert meta["top_crop_ratio"] == 0.22
    assert "Headless" in meta.get("safeguard_note", "") or meta.get("safeguard_stamped") is True


def test_headless_crop_custom_ratio_and_output_dirs(tmp_path: Path):
    src = tmp_path / "turnaround_custom.png"
    Image.new("RGB", (600, 800), color=(100, 100, 100)).save(src)

    nested_out = tmp_path / "sub" / "dir" / "cropped.png"
    meta = create_headless_character_sheet(src, nested_out, top_crop_ratio=0.30)
    assert nested_out.exists()
    cropped = Image.open(nested_out)
    assert cropped.size == (600, 560)
    assert meta["cropped_top_px"] == 240


def test_red_arrow_contact_sheet_renders_annotations(tmp_path: Path):
    base_img = tmp_path / "base.png"
    Image.new("RGB", (800, 450), color=(20, 20, 20)).save(base_img)
    out_img = tmp_path / "contact.png"

    arrows = [{"x1": 100, "y1": 100, "x2": 350, "y2": 220, "label": "GRIP_LOCK"}]
    res = render_red_arrow_contact_sheet(base_img, out_img, arrows=arrows)
    assert out_img.exists()
    assert res["arrows_count"] == 1

    # Verify that the generated image contains red pixels (#FF0000)
    rendered = Image.open(out_img).convert("RGB")
    has_red = any(
        rendered.getpixel((x, y))[0] > 200
        and rendered.getpixel((x, y))[1] < 50
        and rendered.getpixel((x, y))[2] < 50
        for x in range(rendered.width)
        for y in range(rendered.height)
    )
    assert has_red, "Rendered contact sheet must contain high-contrast red annotations"


def test_red_arrow_contact_sheet_with_anchor_boxes(tmp_path: Path):
    base_img = tmp_path / "base2.png"
    Image.new("RGB", (640, 480), color=(30, 30, 30)).save(base_img)
    out_img = tmp_path / "contact2.png"

    arrows = [{"x1": 200, "y1": 200, "x2": 400, "y2": 300, "label": "FORCE_VECTOR"}]
    boxes = [{"x1": 50, "y1": 50, "x2": 180, "y2": 180, "label": "WEAPON_LOCK"}]

    res = render_red_arrow_contact_sheet(base_img, out_img, arrows=arrows, anchor_boxes=boxes)
    assert out_img.exists()
    assert res["boxes_count"] == 1
    assert res["arrows_count"] == 1


def test_single_variable_diff_and_stop_loss():
    prev = "35mm anamorphic lens. @elena sprints across wet floor."
    curr_good = "50mm anamorphic lens. @elena sprints across wet floor."
    diff_ok = analyze_single_variable_diff(prev, curr_good)
    assert diff_ok.is_single_variable is True
    assert diff_ok.diff_count == 1

    # 測試超過 10 次與 15 次停損規則 (Higgsfield Stop-Loss Rule)
    sl_warn = evaluate_stop_loss(iteration_count=11, failure_type="hand_prop_clipping")
    assert sl_warn.action == "SIMPLIFY_BLOCKING_OR_REANCHOR"
    sl_halt = evaluate_stop_loss(iteration_count=15, failure_type="physics_collapse")
    assert sl_halt.action == "INSERT_REACTION_BRIDGE_SHOT"
    assert len(sl_halt.bridge_shot_suggestion) > 10


def test_single_variable_diff_multi_variable_rejection():
    prev = "35mm anamorphic lens. @elena sprints across wet floor."
    curr_bad = "50mm anamorphic lens. @drone_boss sprints across wet floor."
    diff_bad = analyze_single_variable_diff(prev, curr_bad)
    assert diff_bad.is_single_variable is False
    assert diff_bad.diff_count >= 2
    assert len(diff_bad.changed_keys) >= 2


def test_single_variable_diff_structured_sections():
    prev = (
        "GLOBAL STYLE: Neo-Noir Cyberpunk\n"
        "FIRST FRAME AND SPATIAL BLOCKING: @elena at screen-left\n"
        "LENS AND CAMERA MOTION: 35mm anamorphic prime"
    )
    curr_single = (
        "GLOBAL STYLE: Neo-Noir Cyberpunk\n"
        "FIRST FRAME AND SPATIAL BLOCKING: @elena at screen-left\n"
        "LENS AND CAMERA MOTION: 50mm anamorphic prime"
    )
    diff_single = analyze_single_variable_diff(prev, curr_single)
    assert diff_single.is_single_variable is True
    assert diff_single.diff_count == 1
    assert any("LENS" in k for k in diff_single.changed_keys)

    curr_multi = (
        "GLOBAL STYLE: Daylight Hyper-Realism\n"
        "FIRST FRAME AND SPATIAL BLOCKING: @elena at screen-left\n"
        "LENS AND CAMERA MOTION: 50mm anamorphic prime"
    )
    diff_multi = analyze_single_variable_diff(prev, curr_multi)
    assert diff_multi.is_single_variable is False
    assert diff_multi.diff_count == 2


def test_evaluate_stop_loss_thresholds():
    # < 10 iterations: Targeted surgical prompt patch recommendation
    sl_early = evaluate_stop_loss(iteration_count=4, failure_type="hand_prop_clipping")
    assert sl_early.action == "CONTINUE"
    assert len(sl_early.message) > 0
    assert "hand_prop_clipping" in sl_early.message.lower() or "surgical" in sl_early.message.lower()
    assert sl_early.bridge_shot_suggestion == ""

    # 10 to 14 iterations: Warning SIMPLIFY_BLOCKING_OR_REANCHOR
    for i in (10, 12, 14):
        sl_mid = evaluate_stop_loss(iteration_count=i, failure_type="anatomy_distortion")
        assert sl_mid.action == "SIMPLIFY_BLOCKING_OR_REANCHOR"
        assert "5s" in sl_mid.message.lower() or "re-anchor" in sl_mid.message.lower()

    # >= 15 iterations: Halt INSERT_REACTION_BRIDGE_SHOT
    for i in (15, 18):
        sl_halt = evaluate_stop_loss(iteration_count=i, failure_type="physics_collapse")
        assert sl_halt.action == "INSERT_REACTION_BRIDGE_SHOT"
        assert "0.8s" in sl_halt.bridge_shot_suggestion
        assert len(sl_halt.bridge_shot_suggestion) > 20
