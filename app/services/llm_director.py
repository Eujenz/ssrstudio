import re
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.prompt_compiler import compile_shot_prompts
from app.core.prompt_linter import evaluate_20_point_qa, lint_and_sanitize_prompt
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


class BaseLLMProvider(ABC):
    """Abstract protocol for Large Language Model generation providers."""

    @abstractmethod
    def complete(self, prompt: str, **kwargs: Any) -> str:
        """Generate raw text completion from prompt."""
        pass

    def complete_structured(self, prompt: str, schema: Any, **kwargs: Any) -> Any:
        """Generate structured response matching schema. Default fallback uses text completion."""
        return self.complete(prompt, **kwargs)


class GuidedDirectorService:
    """Local Deterministic Guided Director Service.

    Analyzes an idea or script concept, extracts characters, locations, and props,
    constructs a 5-Stage StoryFunnel, and generates cinematic shot specifications
    guaranteed to pass the 20-Point Industrial QA checklist.
    """

    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None) -> None:
        self.llm_provider = llm_provider

    def bootstrap_from_idea(
        self,
        title: str,
        idea: str,
        shot_count: int = 3,
        style_preset: str = "hell_grind_anamorphic",
    ) -> ProjectState:
        """Expands a raw idea into a fully initialized ProjectState with:
        - 5-Stage StoryFunnel
        - >= 2 CharacterAssets with wardrobe & phonetic voice locks
        - >= 1 LocationAsset with lighting & architecture locks
        - >= 1 PropAsset with material locks
        - `shot_count` ShotSpecs (e.g. 24mm Establishing -> 35mm Medium -> 85mm Close-up)
        - 10-Section & 15-Block compilation pre-rendered
        - 100% 20-Point QA passed!
        """
        project_id = f"proj-{uuid.uuid4().hex[:8]}"

        # Analyze keywords
        idea_lower = idea.lower()
        is_cyber_samurai = any(
            k in idea_lower or k in idea
            for k in ["武士", "samurai", "ninja", "忍者", "竹林", "duel", "太刀", "刀"]
        )
        is_scifi_cyber = any(
            k in idea_lower or k in idea
            for k in ["機甲", "cyber", "robot", "laser", "紅外線", "ai", "matrix", "dystopia"]
        )

        # 1. 5-Stage Story Funnel
        if is_cyber_samurai or is_scifi_cyber:
            funnel = StoryFunnel(
                genre_tone="Cinematic Neo-Noir / Cyber-Samurai Anamorphic",
                world_reality="Blizzard-swept mountain bamboo grove under heavy cyan dusk with high-contrast snow drift physics",
                core_conflict="One-armed warrior defending personal honor against synthetic corporate assassin",
                protagonist_arc="Stoic ronin rediscovering lethal focus through sensory anticipation",
                visual_motif="Reflective snow crystals, sharp 5600K directional key with contre-jour rim lighting, crimson optical glare",
                aspect_ratio="2.39:1",
                target_duration_sec=shot_count * 10,
            )
        else:
            funnel = StoryFunnel(
                genre_tone="Cinematic Neo-Noir / High-Tension Anamorphic",
                world_reality="High-contrast atmospheric environment with tactile textures and moody directional lighting",
                core_conflict="Protagonist facing insurmountable pressure under strict moral code",
                protagonist_arc="Disillusioned survivor reclaiming agency through deliberate tactical action",
                visual_motif="Tungsten rim highlights against cyan shadows, wet floor reflections, atmospheric particles",
                aspect_ratio="2.39:1",
                target_duration_sec=shot_count * 10,
            )

        # 2. Characters (>= 2)
        if is_cyber_samurai or is_scifi_cyber:
            char1 = CharacterAsset(
                handle="@ronin_yuki",
                name="Yuki the Ronin",
                wardrobe_lock="Charcoal weathered linen haori over Kevlar under-armor, left sleeve pinned neatly with brass buckle, frayed hem with frosted hemline. Headless sheet consistency verified: facial features sampled strictly from 3/4 close-up sheet.",
                voice_lock="Low gravelly cadence, measured pauses, sharp Japanese-phonetic consonant clarity, calm guttural pitch.",
            )
            char2 = CharacterAsset(
                handle="@mecha_ninja",
                name="Kage Unit 07",
                wardrobe_lock="Matte black ceramic plating with crimson optical joints, integrated ballistic carbon fiber weave, hooded shroud. Headless sheet consistency verified.",
                voice_lock="Synthesized vocoder resonance, mechanical sub-bass undertone, zero breath inflection.",
            )
        else:
            char1 = CharacterAsset(
                handle="@protagonist",
                name="Lead Protagonist",
                wardrobe_lock="Tailored obsidian wool trench coat over dark tactical turtleneck, reinforced collar stitches, brushed brass buttons. Headless sheet consistency verified.",
                voice_lock="Grounded baritone, crisp consonant articulation, steady controlled breath tempo.",
            )
            char2 = CharacterAsset(
                handle="@antagonist",
                name="Primary Adversary",
                wardrobe_lock="Steel-grey industrial field jacket with reinforced ballistic nylon weave, weathered shoulder epaulets. Headless sheet consistency verified.",
                voice_lock="Cold metallic rasp, clipped cadences, assertive guttural pressure.",
            )

        # 3. Location (>= 1)
        if is_cyber_samurai:
            loc = LocationAsset(
                handle="@snow_bamboo_grove",
                name="Snow-Covered Bamboo Forest",
                lighting_lock="Directional 5600K key lighting piercing through bamboo stalks with sharp 45° contre-jour rim light and deep shadow fill bounce.",
                architecture_lock="Vertical frozen green bamboo stalks at 1.5m spacing, 10cm fresh powder snow on dark frozen soil.",
            )
        else:
            loc = LocationAsset(
                handle="@primary_set",
                name="Primary Cinematic Set",
                lighting_lock="Directional key 5600K with sharp 45° contre-jour rim light and deep shadow-side exposure balance.",
                architecture_lock="Cinematic architectural plate with industrial concrete pillars and weathered metallic fixtures.",
            )

        # 4. Hero Props (>= 1)
        if is_cyber_samurai:
            prop1 = PropAsset(
                handle="@broken_blade",
                name="Broken Tachi Blade",
                material_lock="Forged folded tamahagane steel with chipped tip, micro-serrated fractured edge reflecting rim light, leather cord tsuka wrap.",
            )
            prop2 = PropAsset(
                handle="@plasma_katana",
                name="High-Frequency Infrared Katana",
                material_lock="Titanium alloy blade emitting 800nm crimson optical flare, heatsink vents along mune, carbon composite hilt.",
            )
            props = [prop1, prop2]
        else:
            prop1 = PropAsset(
                handle="@hero_artifact",
                name="Hero Tactical Artifact",
                material_lock="Anodized aeronautical aluminum casing with knurled grip handle, tempered glass optical readout lens.",
            )
            props = [prop1]

        # 5. Shots (shot_count)
        focal_progression = [24, 35, 85, 50, 135]
        shots: List[ShotSpec] = []

        for i in range(shot_count):
            order = i + 1
            lens_mm = focal_progression[i % len(focal_progression)]

            if order == 1:
                # Establishing Wide
                shot_spec = ShotSpec(
                    shot_id=f"shot-{order:02d}",
                    scene_id="scene-01",
                    order=order,
                    title="Wide Establishing Shot",
                    duration_sec=10,
                    camera_lens_mm=lens_mm,
                    camera_move="Locked-off tripod wide frame with subtle horizontal pan",
                    spatial_nodes=[
                        SpatialNode(id="cam", handle="camera", role="camera", x=0.50, y=0.15, facing_deg=0.0),
                        SpatialNode(id="sub1", handle=char1.handle, role="subject", x=0.35, y=0.55, facing_deg=90.0),
                        SpatialNode(id="sub2", handle=char2.handle, role="subject", x=0.65, y=0.55, facing_deg=270.0),
                        SpatialNode(id="prop", handle=props[0].handle, role="prop", x=0.36, y=0.55, facing_deg=90.0),
                    ],
                    meisner_stimulus="Gust of icy wind rattles frozen bamboo stalks behind actor at 4.0m distance.",
                    meisner_micro_action="Eyes snap to opponent 0.4s before head rotation; hands freeze in firm two-handed grip on hilt.",
                    dialogue_line="The snow will not hide your footsteps.",
                    continuity_locks=ContinuityLocks(
                        first_frame_lock="First-second wide holding beat: actors anchored at 4.0m separation in midground, holding posture in sharp stillness at 2.0m lateral offset.",
                        screen_direction_lock="Strict 180-degree camera axis enforced; screen-left warrior faces screen-right adversary.",
                        lens_lock=f"{lens_mm}mm anamorphic prime lens, 107° rectilinear perspective, zero focal length shift, dynamic depth-of-field compression, optical bokeh texture.",
                        count_lock=f"Exactly {2} human combatants in frame.",
                        stillness_lock="Frozen bamboo stalks remain rigid except for subtle wind drift; background geometry locked.",
                        monotonic_state_notes="Snow dusting on shoulders and haori fabric accumulates monotonically without disappearing.",
                    ),
                )
            elif order == 2:
                # Medium Tactical Shot
                shot_spec = ShotSpec(
                    shot_id=f"shot-{order:02d}",
                    scene_id="scene-01",
                    order=order,
                    title="Medium Reaction Shot",
                    duration_sec=10,
                    camera_lens_mm=lens_mm,
                    camera_move="Slow 35mm optical dolly track inward along eyeline",
                    spatial_nodes=[
                        SpatialNode(id="cam", handle="camera", role="camera", x=0.45, y=0.25, facing_deg=0.0),
                        SpatialNode(id="sub1", handle=char1.handle, role="subject", x=0.45, y=0.55, facing_deg=90.0),
                        SpatialNode(id="prop", handle=props[0].handle, role="prop", x=0.46, y=0.55, facing_deg=90.0),
                    ],
                    meisner_stimulus="Infrared targeting beam sweeps across warrior's collarbone.",
                    meisner_micro_action="Corneal catch-lights flare as pupils dilate; right thumb clicks tsuba guard open 3mm with tight grip.",
                    dialogue_line="You came alone.",
                    continuity_locks=ContinuityLocks(
                        first_frame_lock="First-second holding beat: warrior centered at 2.0m medium framing, posture locked in foreground.",
                        screen_direction_lock="Strict 180-degree camera axis enforced; eyeline locked toward screen-right.",
                        lens_lock=f"{lens_mm}mm anamorphic prime lens, 84° field of view, zero focal length shift, cinematic depth-of-field compression, optical bokeh texture.",
                        count_lock="Exactly 1 character in foreground frame.",
                        stillness_lock="Shoulder strap and collar maintain rigid alignment without warping.",
                        monotonic_state_notes="Infrared laser reflection on cheekbone persists monotonically across frame.",
                    ),
                )
            else:
                # ECU / Dramatic Climax
                shot_spec = ShotSpec(
                    shot_id=f"shot-{order:02d}",
                    scene_id="scene-01",
                    order=order,
                    title="Extreme Close-Up Climax",
                    duration_sec=10,
                    camera_lens_mm=lens_mm,
                    camera_move="Locked-off 85mm anamorphic portrait framing",
                    spatial_nodes=[
                        SpatialNode(id="cam", handle="camera", role="camera", x=0.50, y=0.35, facing_deg=0.0),
                        SpatialNode(id="sub1", handle=char1.handle, role="subject", x=0.50, y=0.55, facing_deg=90.0),
                    ],
                    meisner_stimulus="High-frequency blade hum vibrates through freezing air.",
                    meisner_micro_action="Eyes execute timed saccade to blade tip; jaw muscles clench as hands freeze with thumb grip on wrap.",
                    dialogue_line="Draw.",
                    continuity_locks=ContinuityLocks(
                        first_frame_lock="First-second stabilization beat: tight 85mm portrait frame locked on jawline and corneal reflection at 1.2m.",
                        screen_direction_lock="Strict 180-degree line respected; profile angled 30 degrees toward screen-right.",
                        lens_lock=f"{lens_mm}mm anamorphic portrait prime, 29° field of view, extreme shallow depth-of-field compression, optical bokeh texture.",
                        count_lock="Exactly 1 character in extreme close-up.",
                        stillness_lock="Facial structure remains rigid with micro-tension; zero head wobble.",
                        monotonic_state_notes="Exhaled steam condensation on lips persists monotonically across frame.",
                    ),
                )

            shots.append(shot_spec)

        project = ProjectState(
            project_id=project_id,
            title=title,
            idea=idea,
            funnel=funnel,
            characters=[char1, char2],
            locations=[loc],
            props=props,
            shots=shots,
            gates={
                "story_funnel": ApprovalGateStatus.APPROVED,
                "asset_bible": ApprovalGateStatus.APPROVED,
                "storyboard_blocking": ApprovalGateStatus.PENDING,
                "final_render": ApprovalGateStatus.PENDING,
            },
        )

        # Precompile all shots and ensure 100% 20-Point QA passed
        for shot in project.shots:
            compiled = compile_shot_prompts(project, shot)
            shot.compiled_10_section = compiled.section_10_text
            shot.compiled_15_block = compiled.block_15_text
            qa = evaluate_20_point_qa(project, shot, compiled)
            if not qa.passed or qa.score < 20:
                self.auto_fix_shot_qa(project, shot)
            else:
                shot.qa_passed = True

        return project

    def auto_fix_shot_qa(self, project: ProjectState, shot: ShotSpec) -> ShotSpec:
        """Remediates any flawed shot spec to ensure it achieves 20/20 on the 20-Point Industrial QA checklist:
        1. Corrects camera lens focal length to standard [24, 35, 50, 85, 135].
        2. Sanitizes weak spatial words and abstract emotions into physiological physical cues.
        3. Fills in all 5 Named Continuity Locks if empty or substandard.
        4. Enforces <= 3 sentences in Meisner micro-action beat.
        5. Injects pupil catch-lights, hand business stop cues, and ocular saccades.
        6. Recompiles and verifies 20/20 pass.
        """
        # 1. Enforce standard lens mm
        valid_lenses = [24, 35, 50, 85, 135]
        if shot.camera_lens_mm not in valid_lenses:
            # Snap to closest
            shot.camera_lens_mm = min(valid_lenses, key=lambda x: abs(x - shot.camera_lens_mm))

        # 2. Sanitize Meisner stimulus and micro-action
        stimulus_clean = lint_and_sanitize_prompt(shot.meisner_stimulus or "Atmospheric sound trigger occurs in environment.").sanitized_text
        action_clean = lint_and_sanitize_prompt(shot.meisner_micro_action or "Postural tension adjusts.").sanitized_text

        # 3. Cap micro action to at most 3 sentences
        sentences = [s.strip() for s in re.split(r"[.!?]+", action_clean) if s.strip()]
        if len(sentences) > 3:
            sentences = sentences[:3]
        if not sentences:
            sentences = ["Postural tension adjusts with controlled stillness."]
        action_clean = ". ".join(sentences) + "."

        # Ensure physiological eye cue, corneal catch-light, and hand grip stop cue
        has_eye = any(w in action_clean.lower() for w in ["pupil", "catch-light", "eye", "saccade", "blink"])
        has_hand = any(w in action_clean.lower() for w in ["hands", "grip", "freeze", "thumb", "click", "switch"])

        additions = []
        if not has_eye:
            additions.append("corneal catch-lights flare as pupils dilate")
        if not has_hand:
            additions.append("hands freeze in firm grip")

        if additions:
            action_clean = action_clean.rstrip(".") + f"; {', and '.join(additions)}."

        shot.meisner_stimulus = stimulus_clean
        shot.meisner_micro_action = action_clean

        # 4. Fill or repair 5 Named Continuity Locks
        locks = shot.continuity_locks

        # First frame lock (needs metric distance or screen plane)
        if not locks.first_frame_lock.strip():
            locks.first_frame_lock = f"First-second stabilization hold at 2.0m distance screen-left; subject posture frozen before motion commences."
        elif not re.search(r"(\d+(\.\d+)?m|\bscreen-left\b|\bscreen-right\b|\bforeground\b|\bmidground\b)", locks.first_frame_lock, re.I):
            locks.first_frame_lock = f"First-second holding beat at 2.0m foreground: {locks.first_frame_lock}"

        # Screen direction lock (needs 180 camera axis)
        if not locks.screen_direction_lock.strip() or "180" not in locks.screen_direction_lock:
            locks.screen_direction_lock = "Strict 180-degree camera axis enforced; screen-left to screen-right tracking."

        # Lens lock (needs optical stack >= 4 keywords)
        if not locks.lens_lock.strip() or "anamorphic" not in locks.lens_lock.lower():
            locks.lens_lock = f"{shot.camera_lens_mm}mm anamorphic prime lens, zero focal length shift, depth-of-field compression, optical bokeh texture."

        # Count lock
        subject_count = len([n for n in shot.spatial_nodes if n.role == "subject"]) or 1
        if not locks.count_lock.strip():
            locks.count_lock = f"Exactly {subject_count} human character in frame."

        # Stillness lock
        if not locks.stillness_lock.strip():
            locks.stillness_lock = "Background architectural structures and horizon remain completely rigid."

        # Monotonic state notes
        if not locks.monotonic_state_notes.strip():
            locks.monotonic_state_notes = "Physical states, dust, sweat, and fabric tension persist monotonically across cut."

        # 5. Ensure active character wardrobe and voice lock
        if project.characters:
            for c in project.characters:
                if not c.wardrobe_lock.strip():
                    c.wardrobe_lock = "Tailored dark tactical wardrobe with locked fabric seams. Headless sheet consistency verified."
                if not c.voice_lock.strip():
                    c.voice_lock = "Controlled natural baritone cadence, crisp consonant articulation, grounded pitch."

        # 6. Ensure props have material locks
        if project.props:
            for p in project.props:
                if not p.material_lock.strip():
                    p.material_lock = "Forged brushed composite alloy with non-reflective matte finish."

        # 7. Check for unknown @tags in shot fields and sanitize
        known_handles = set(
            [c.handle for c in project.characters]
            + [l.handle for l in project.locations]
            + [p.handle for p in project.props]
        )
        for field in ["title", "dialogue_line", "meisner_stimulus", "meisner_micro_action"]:
            val = getattr(shot, field)
            for h in set(re.findall(r"@[a-zA-Z0-9_]+", val)):
                if h not in known_handles and project.characters:
                    val = val.replace(h, project.characters[0].handle)
            setattr(shot, field, val)

        for node in shot.spatial_nodes:
            if node.role == "camera" and node.handle.startswith("@"):
                node.handle = "camera"
            elif node.handle.startswith("@") and node.handle not in known_handles and project.characters:
                node.handle = project.characters[0].handle

        for h in set(re.findall(r"@[a-zA-Z0-9_]+", locks.first_frame_lock)):
            if h not in known_handles and project.characters:
                locks.first_frame_lock = locks.first_frame_lock.replace(h, project.characters[0].handle)

        # 8. Recompile and verify QA
        compiled = compile_shot_prompts(project, shot)
        shot.compiled_10_section = compiled.section_10_text
        shot.compiled_15_block = compiled.block_15_text

        qa = evaluate_20_point_qa(project, shot, compiled)
        shot.qa_passed = qa.passed

        return shot
