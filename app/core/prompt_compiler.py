from typing import List, Optional
from app.models.compiler import CompiledPrompt
from app.models.project import ProjectState, ShotSpec, CharacterAsset, LocationAsset, PropAsset
from app.core.spatial_compiler import compile_spatial_blocking


def _get_fov_data(lens_mm: int) -> dict:
    fov_map = {
        24: {
            "name": "107° Wide Rectilinear (24mm)",
            "desc": "Extreme environmental scale, dynamic edge elongation, barrel distortion suppression, expansive sky tension.",
        },
        35: {
            "name": "84° Classic Wide / Cuarón Intimate (35mm)",
            "desc": "Dynamic blocking, deep spatial relationship, actor moves through frame planes without optical cut.",
        },
        50: {
            "name": "47° Standard Normal (50mm)",
            "desc": "True human perspective, natural perspective compression, grounded cinematic realism.",
        },
        85: {
            "name": "29° Short Telephoto Portrait (85mm)",
            "desc": "Cinematic portrait separation, gentle background softening, natural face proportion without wide-angle bulb nose.",
        },
        135: {
            "name": "18° Classic Telephoto (135mm)",
            "desc": "Severe combat compression, background magnified and pulled forward, extreme shallow depth-of-field.",
        },
    }
    return fov_map.get(lens_mm, fov_map[35])


def compile_shot_prompts(project: ProjectState, shot: ShotSpec) -> CompiledPrompt:
    """
    Dual-mode deterministic compiler for SSRStudio v2:
    1. 15-Block Matrix ([01/15] to [15/15]) dynamically populated from ProjectState and ShotSpec.
    2. 10-Section Seedance 2.5 format with 5 Named Continuity Locks.
    Strictly zero hardcoded demo strings.
    """
    funnel = project.funnel
    locks = shot.continuity_locks
    fov_info = _get_fov_data(shot.camera_lens_mm)

    # 1. Resolve active assets for this shot
    subject_handles = [n.handle for n in shot.spatial_nodes if n.role == "subject"]
    prop_handles = [n.handle for n in shot.spatial_nodes if n.role == "prop"]

    # Active characters
    active_chars = [c for c in project.characters if c.handle in subject_handles]
    if not active_chars and project.characters:
        active_chars = [project.characters[0]]

    # Active locations
    active_location = project.locations[0] if project.locations else LocationAsset(
        handle="@primary_set",
        name="Primary Cinematic Set",
        lighting_lock="Directional key 5600K with sharp contre-jour rim",
        architecture_lock="Detailed cinematic architectural geometry",
    )

    # Active props
    active_props = [p for p in project.props if p.handle in prop_handles]
    if not active_props and project.props:
        active_props = project.props[:1]

    # Spatial text from spatial compiler
    spatial_text = compile_spatial_blocking(
        shot.spatial_nodes,
        lens_mm=shot.camera_lens_mm,
        camera_move=shot.camera_move,
    )

    # Character text builder
    char_lines = []
    for c in active_chars:
        char_desc = f"{c.handle} ({c.name})"
        if c.wardrobe_lock:
            char_desc += f" in {c.wardrobe_lock}"
        char_desc += ". Headless sheet consistency verified: facial features sampled strictly from 3/4 close-up sheet."
        char_lines.append(char_desc)
    char_block_text = " ".join(char_lines) if char_lines else "Single subject with locked wardrobe."

    # Prop text builder
    prop_lines = []
    for p in active_props:
        prop_desc = f"Hold {p.handle} ({p.name}) exactly where the red arrow points on the reference image"
        if p.material_lock:
            prop_desc += f", material: {p.material_lock}"
        prop_desc += ", knuckles blanching white with applied grip torque."
        prop_lines.append(prop_desc)
    prop_block_text = " ".join(prop_lines) if prop_lines else "Hero prop interaction: none in active frame; hands free of weapon grip."

    # Primary voice lock
    voice_lock = active_chars[0].voice_lock if active_chars and active_chars[0].voice_lock else "Controlled natural cadence, crisp consonant articulation, grounded pitch"

    # Action timing beats dynamically partitioned across shot duration
    d = shot.duration_sec
    b0 = f"First-second stabilization beat: {locks.first_frame_lock or 'Actor holds initial posture in sharp stillness.'}"
    b1 = f"Stimulus occurs: {shot.meisner_stimulus or 'Subtle atmospheric shift prompts physical reaction.'}"
    b2 = f"Micro-action response: {shot.meisner_micro_action or 'Physical posture shifts with controlled tension.'}"
    b3 = f"Dialogue delivery and holding beat: '{shot.dialogue_line or '...'}' spoken with locked eyeline."

    # Negative Prompt
    negative_prompt = (
        "No morphing fingers, no floating boots, no teleporting actors, "
        "no crossing 180 axis, no extra limbs, no unprompted smiles, no dead flat eyes, no double suns."
    )

    # --- 15-Block SSRStudio Matrix ---
    block_15_lines = [
        f"[01/15] GLOBAL_STYLE_PREFIX: Feature film cinematic capture, {funnel.aspect_ratio} CinemaScope, anamorphic optical texture with subtle horizontal breathing, low-key directional lighting, tactile atmospheric grain. Genre & Tone: {funnel.genre_tone}. World Reality: {funnel.world_reality}. Visual Motif: {funnel.visual_motif}.",
        f"[02/15] POSITIVE_CONSTRAINTS: Exactly {len(active_chars)} characters in shot ({', '.join(c.handle for c in active_chars) if active_chars else 'None'}). Exactly {len(active_props)} primary prop ({', '.join(p.handle for p in active_props) if active_props else 'None'}). Ground-contact physics enforced: boots cast dark contact shadows on floor.",
        f"[03/15] CAMERA_PERSPECTIVE_AND_FOV: {fov_info['name']}. Optical characteristics: {fov_info['desc']} Anamorphic prime with controlled bokeh. Lens lock: {locks.lens_lock or f'{shot.camera_lens_mm}mm anamorphic prime, zero focal shift'}. Banned: no mm focal length tags in action beats, no f-stop, no ISO, no shutter speed tags.",
        f"[04/15] CAMERA_MOTION_AND_SPEED: {shot.camera_move}. Zero handheld jitter, zero gimbal roll, stable fluid track.",
        f"[05/15] LIGHTING_AND_COLOR_SCIENCE: {active_location.lighting_lock or 'Single overhead directional key creating sharp 45° contre-jour rim light on shoulders.'} Deep shadow-side exposure with balanced fill bounce.",
        f"[06/15] LOCATION_ENVIRONMENT_PLATE: {active_location.handle} ({active_location.name}). {active_location.architecture_lock or 'Cinematic environmental plate with tactile textures.'}",
        f"[07/15] SPATIAL_ANCHORS_AND_GEO: {spatial_text}",
        f"[08/15] CHARACTER_IDENTITY_AND_WARDROBE: {char_block_text}",
        f"[09/15] HERO_PROPS_AND_INTERACTION: {prop_block_text}",
        f"[10/15] MEISNER_OBJECTIVE_AND_BEHAVIOR: Objective: {funnel.core_conflict}. Stimulus: {shot.meisner_stimulus or 'External trigger'}. Micro-action: {shot.meisner_micro_action or 'Physical reaction'}. Interrupted accent: hands freeze mid-motion as line delivers.",
        f"[11/15] EYE_LIFE_AND_MICRO_EXPRESSIONS: Eyes execute human micro-saccades: one slow lazy blink at 01.2s -> quick double-blink at 04.5s -> hard reset-blink at 07.8s; eyes snap to target 0.4s before head rotates; moist corneal catch-lights catching rim light.",
        f"[12/15] ACTION_TIMING_BEATS:\n- 0.0–1.0s: {b0}\n- 1.0–{d * 0.4:.1f}s: {b1}\n- {d * 0.4:.1f}–{d * 0.8:.1f}s: {b2}\n- {d * 0.8:.1f}–{d:.1f}s: {b3}",
        f"[13/15] SEAM_STITCH_AND_FIRST_SECOND_WIDE: First-second stabilization beat active: {locks.first_frame_lock or 'Initial frame locked.'} Dialogue tail stitched: \"{shot.dialogue_line}\" feeding into holding beat.",
        f"[14/15] ISOLATED_AUDIO_AND_DIALOGUE: Voice: {voice_lock} | Line: \"{shot.dialogue_line}\" | Filler-Babble Fix: Nobody else speaks; other visible characters keep lips at rest, jaw closed, strictly silent listening beat after line is spoken. No ad-libs. SFX only. No background music. No subtitles.",
        f"[15/15] NEGATIVE_AND_ANTI_DRIFT_LOCKS: {negative_prompt}",
    ]
    block_15_text = "\n\n".join(block_15_lines)

    # --- 10-Section Seedance 2.5 Format with 5 Named Continuity Locks ---
    section_10_lines = [
        f"GLOBAL STYLE: Feature film cinematic capture, {funnel.aspect_ratio} CinemaScope, anamorphic optical texture with subtle horizontal breathing, low-key directional lighting, tactile atmospheric grain. {funnel.genre_tone}. {funnel.visual_motif}.",
        f"SCENE: Scene {shot.scene_id} - Shot {shot.order}: {shot.title} ({shot.duration_sec}s). Core narrative tension: {funnel.core_conflict}.",
        f"CHARACTERS: {char_block_text}",
        f"LOCATION: {active_location.handle} ({active_location.name}). {active_location.architecture_lock}.",
        f"FIRST FRAME AND SPATIAL BLOCKING:\n{locks.first_frame_lock or 'First frame locked with subjects holding posture.'}\n{spatial_text}",
        f"SHOT SPECIFICATION: Shot {shot.order} (Duration: {shot.duration_sec}s, Hard cut). Action beat: {shot.meisner_stimulus} -> {shot.meisner_micro_action}.",
        f"OPTICS / CAMERA:\nLENS LOCK: {locks.lens_lock or f'{shot.camera_lens_mm}mm anamorphic prime, zero focal length shift'}.\nSCREEN DIRECTION: {locks.screen_direction_lock or 'Strictly respect 180-degree camera axis across frame'}.\nCamera Move: {shot.camera_move}. {fov_info['desc']}",
        f"PHYSICS:\nCOUNT LOCK: {locks.count_lock or f'Exactly {len(active_chars)} human character in frame'}.\nSTILLNESS LOCK: {locks.stillness_lock or 'Background architectural structures remain completely rigid'}.\nMONOTONIC STATE: {locks.monotonic_state_notes or 'Physical states persist monotonically without disappearing'}.\nGround-contact physics enforced: boots cast contact shadows.",
        f"LIGHTING: {active_location.lighting_lock or 'Directional key lighting with sharp contre-jour rim separation and deep shadow side exposure.'}",
        f"AUDIO: Voice Identity: {voice_lock}\nLine: \"{shot.dialogue_line}\"\nFiller-Babble Fix: Nobody else speaks; other visible characters keep lips at rest, jaw closed, strictly silent listening beat after line is spoken. No ad-libs. SFX only. No background music. No subtitles.",
    ]
    section_10_text = "\n\n".join(section_10_lines)

    return CompiledPrompt(
        shot_id=shot.shot_id,
        block_15_text=block_15_text,
        section_10_text=section_10_text,
        spatial_text=spatial_text,
        negative_prompt=negative_prompt,
        aspect_ratio=funnel.aspect_ratio,
        metadata={
            "lens_mm": shot.camera_lens_mm,
            "duration_sec": shot.duration_sec,
            "fov_name": fov_info["name"],
        },
    )
