from pathlib import Path
from PIL import Image

from app.core.prompt_compiler import compile_shot_prompts
from app.core.prompt_linter import evaluate_20_point_qa
from app.models.project import ContinuityLocks, ProjectState, ShotSpec, SpatialNode
from app.services.llm_director import BaseLLMProvider, GuidedDirectorService
from app.services.media_providers import (
    BaseImageProvider,
    BaseTTSProvider,
    BaseVideoProvider,
    LocalAnimaticProvider,
)
from app.services.timeline_composer import TimelineComposer, TimelineManifest


def test_guided_director_generates_complete_ready_to_compile_project(tmp_path: Path):
    director = GuidedDirectorService()
    project = director.bootstrap_from_idea(
        title="Snow Bamboo Duel",
        idea="一名獨臂女武士在暴風雪竹林中，用斷刃精準架開機甲忍者的紅外線高頻太刀",
        shot_count=3,
        style_preset="hell_grind_anamorphic",
    )

    # 1. Asset & Funnel validations
    assert len(project.characters) >= 2
    assert len(project.locations) >= 1
    assert len(project.props) >= 1
    assert len(project.shots) == 3
    assert project.funnel.aspect_ratio == "2.39:1"

    # All characters must have wardrobe lock and phonetic voice lock
    for char in project.characters:
        assert len(char.wardrobe_lock.strip()) > 0
        assert len(char.voice_lock.strip()) > 0

    # All locations must have lighting and architecture lock
    for loc in project.locations:
        assert len(loc.lighting_lock.strip()) > 0
        assert len(loc.architecture_lock.strip()) > 0

    # 2. Shot validations & 20-Point QA verification
    animatic = LocalAnimaticProvider()
    focal_lengths = [s.camera_lens_mm for s in project.shots]
    assert focal_lengths == [24, 35, 85]

    for shot in project.shots:
        assert len(shot.spatial_nodes) >= 1
        assert len(shot.meisner_stimulus.strip()) > 0
        assert len(shot.meisner_micro_action.strip()) > 0
        assert len(shot.continuity_locks.first_frame_lock.strip()) > 0
        assert len(shot.continuity_locks.screen_direction_lock.strip()) > 0
        assert len(shot.continuity_locks.lens_lock.strip()) > 0
        assert len(shot.continuity_locks.count_lock.strip()) > 0
        assert len(shot.continuity_locks.stillness_lock.strip()) > 0

        # Compile prompts and evaluate QA
        compiled = compile_shot_prompts(project, shot)
        qa = evaluate_20_point_qa(project, shot, compiled)
        assert qa.passed is True, f"Shot {shot.shot_id} failed QA: {[c.name for c in qa.checks if not c.passed]}"
        assert qa.score == 20

        # Render animatic slate PNG
        slate_path = tmp_path / f"{shot.shot_id}_slate.png"
        rendered_path = animatic.render_shot_slate(project, shot, slate_path)
        assert Path(rendered_path).exists()

        # Verify Pillow animatic dimensions (1920x804 Anamorphic 2.39:1)
        with Image.open(rendered_path) as img:
            assert img.size == (1920, 804)


def test_auto_fix_shot_qa():
    director = GuidedDirectorService()
    project = director.bootstrap_from_idea(
        title="Test Duel",
        idea="Duel between swordsman and rogue",
        shot_count=1,
    )

    # Deliberately construct a broken shot that fails QA checks
    broken_shot = ShotSpec(
        shot_id="shot-broken",
        order=1,
        title="Broken Shot",
        camera_lens_mm=42,  # Invalid focal length (fails qa-01)
        duration_sec=10,
        meisner_stimulus="Actor feels angry and sad next to the door.",  # Abstract emotion & weak spatial (fails qa-02)
        meisner_micro_action="He turns around quickly. He looks up scared. Then he looks down anxious. And then he sighs.",  # >3 sentences + emotion (fails qa-02, qa-17)
        dialogue_line="I am not afraid.",
        continuity_locks=ContinuityLocks(),  # Empty locks (fails qa-08, qa-16, qa-18)
    )

    compiled_broken = compile_shot_prompts(project, broken_shot)
    qa_broken = evaluate_20_point_qa(project, broken_shot, compiled_broken)
    assert qa_broken.passed is False
    assert qa_broken.score < 20

    # Auto-fix the shot
    fixed_shot = director.auto_fix_shot_qa(project, broken_shot)
    assert fixed_shot.camera_lens_mm in (24, 35, 50, 85, 135)

    compiled_fixed = compile_shot_prompts(project, fixed_shot)
    qa_fixed = evaluate_20_point_qa(project, fixed_shot, compiled_fixed)
    assert qa_fixed.passed is True, f"Auto-fixed shot still failed QA: {[c.name for c in qa_fixed.checks if not c.passed]}"
    assert qa_fixed.score == 20
    assert fixed_shot.qa_passed is True


def test_timeline_composer():
    director = GuidedDirectorService()
    project = director.bootstrap_from_idea(
        title="Snow Bamboo Duel",
        idea="武士與忍者竹林決戰",
        shot_count=3,
    )

    composer = TimelineComposer()
    manifest = composer.compile_timeline_manifest(project)

    assert isinstance(manifest, TimelineManifest)
    assert manifest.project_id == project.project_id
    assert manifest.total_shots == 3
    assert manifest.total_duration_sec == sum(s.duration_sec for s in project.shots)
    assert len(manifest.clips) == 3

    # Check J/L cut audio offsets and transition notes
    for i, clip in enumerate(manifest.clips):
        assert clip.order == i + 1
        assert clip.duration_sec == project.shots[i].duration_sec
        assert "audio_offset_sec" in clip.metadata
        assert "transition" in clip.metadata

    # Generate FFmpeg concat script / command line
    ffmpeg_cmd = composer.generate_ffmpeg_concat_script(
        project,
        manifest,
        output_path="renders/preview_239.mp4",
    )
    assert "ffmpeg" in ffmpeg_cmd
    assert "preview_239.mp4" in ffmpeg_cmd
    assert "1920:804" in ffmpeg_cmd or "1920x804" in ffmpeg_cmd or "concat" in ffmpeg_cmd


def test_abstract_providers_protocols():
    # Verify protocols can be subclassed
    class DummyLLM(BaseLLMProvider):
        def complete(self, prompt: str, **kwargs) -> str:
            return "ok"

    class DummyImage(BaseImageProvider):
        def generate_image(self, prompt: str, **kwargs) -> str:
            return "dummy.png"

    class DummyVideo(BaseVideoProvider):
        def generate_video(self, prompt: str, **kwargs) -> str:
            return "dummy.mp4"

    class DummyTTS(BaseTTSProvider):
        def synthesize_speech(self, text: str, **kwargs) -> str:
            return "dummy.wav"

    llm = DummyLLM()
    assert llm.complete("test") == "ok"
    img = DummyImage()
    assert img.generate_image("test") == "dummy.png"
    vid = DummyVideo()
    assert vid.generate_video("test") == "dummy.mp4"
    tts = DummyTTS()
    assert tts.synthesize_speech("test") == "dummy.wav"
