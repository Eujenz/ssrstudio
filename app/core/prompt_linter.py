import re
from typing import Dict, List, Tuple
from app.models.compiler import LintIssue, LintResult, QAAuditItem, QAAuditResult, CompiledPrompt
from app.models.project import ProjectState, ShotSpec


# Dictionary of weak prepositions / spatial phrases and their metric / anchor replacements
WEAK_SPATIAL_RULES: Dict[str, str] = {
    r"\bnext to\b": "adjacent to at 1.0m",
    r"\bby the side of\b": "at 1.0m lateral offset from",
    r"\bclose to\b": "within 0.8m of",
    r"\bnear\b": "at 1.5m from",
    r"\bbeside\b": "flanking at 1.2m",
    r"\baround\b": "encircling at 2.0m radius",
    r"\bsomewhere\b": "centered specifically",
}

# Dictionary of non-visual abstract emotion words and their physiological visual replacements
EMOTION_RULES: Dict[str, str] = {
    r"\bsad\b": "eyes lowered with downturned mouth corners",
    r"\bangry\b": "jaw clenched and brow furrowed",
    r"\bfurious\b": "nostrils flared, teeth bared in tight grimace",
    r"\bhappy\b": "relaxed facial posture with subtle corner-of-mouth lift",
    r"\bdepressed\b": "shoulders slouched, eyes staring blankly downward",
    r"\bconfused\b": "head cocked 15°, one brow slightly elevated",
    r"\bscared\b": "pupils dilated, shallow rapid inhalation",
    r"\bnervous\b": "hands trembling slightly with restless thumb movement",
    r"\bexcited\b": "sharp upright posture, eyes tracking rapidly",
    r"\banxious\b": "fingers clenching and unclenching rhythmically",
    r"\bworried\b": "forehead furrowed with tightened eyelids",
    r"\bdisturbed\b": "stiffened neck with fixed gaze",
    r"\bupset\b": "lips pressed together tightly into a bloodless line",
    r"\bemotional\b": "chest heaving with held tension",
}


def lint_and_sanitize_prompt(prompt: str) -> LintResult:
    """
    Scans a prompt for weak spatial prepositions and abstract emotion adjectives.
    Returns detected issues with positions and a sanitized version replacing weak
    patterns with physical/physiological cues.
    """
    issues: List[LintIssue] = []
    sanitized = prompt

    # 1. Check weak spatial rules
    for pattern, replacement in WEAK_SPATIAL_RULES.items():
        for match in re.finditer(pattern, prompt, flags=re.IGNORECASE):
            issues.append(
                LintIssue(
                    category="weak_spatial",
                    word=match.group(0),
                    suggestion=replacement,
                    position=match.start(),
                )
            )
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

    # 2. Check emotion rules
    for pattern, replacement in EMOTION_RULES.items():
        for match in re.finditer(pattern, prompt, flags=re.IGNORECASE):
            issues.append(
                LintIssue(
                    category="abstract_emotion",
                    word=match.group(0),
                    suggestion=replacement,
                    position=match.start(),
                )
            )
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

    return LintResult(
        detected_count=len(issues),
        sanitized_text=sanitized,
        issues=issues,
        original_text=prompt,
    )


def evaluate_20_point_qa(
    project: ProjectState,
    shot: ShotSpec,
    compiled: CompiledPrompt,
) -> QAAuditResult:
    """
    Evaluates a shot and its compiled prompt against the 20-Point Industrial QA Checklist.
    Returns itemized audit results with exact remediation instructions.
    """
    checks: List[QAAuditItem] = []

    full_compiled_text = f"{compiled.block_15_text}\n{compiled.section_10_text}"
    locks = shot.continuity_locks

    # Registered handles in project
    all_known_handles = set(
        [c.handle for c in project.characters]
        + [l.handle for l in project.locations]
        + [p.handle for p in project.props]
    )

    # 1. Zero mm/ISO lens tags in action beats (optical tags isolated to optical block)
    # Check that forbidden ISO or shutter speed tags are not leaked
    has_forbidden_iso = bool(re.search(r"\b(ISO\s*\d+|f/\d+(\.\d+)?|1/\d+s)\b", full_compiled_text, re.IGNORECASE))
    c1_passed = not has_forbidden_iso and bool(shot.camera_lens_mm in (24, 35, 50, 85, 135))
    checks.append(
        QAAuditItem(
            id="qa-01",
            name="Zero mm/ISO lens tags",
            passed=c1_passed,
            detail="Forbidden optical artifacts (ISO, f-stop, shutter speed) suppressed; lens mm locked." if c1_passed else "Forbidden ISO/shutter speed tags detected or lens mm not standard.",
            remedy="Remove raw exposure tags (ISO, f-stop) and restrict lens specification to optical block.",
        )
    )

    # 2. Zero emotion adjectives
    lint_check = lint_and_sanitize_prompt(f"{shot.meisner_stimulus} {shot.meisner_micro_action} {full_compiled_text}")
    emotion_issues = [i for i in lint_check.issues if i.category == "abstract_emotion"]
    c2_passed = len(emotion_issues) == 0
    checks.append(
        QAAuditItem(
            id="qa-02",
            name="Zero emotion adjectives",
            passed=c2_passed,
            detail="All emotions translated to Meisner physiological muscle cues." if c2_passed else f"Detected abstract emotion words: {[i.word for i in emotion_issues]}.",
            remedy="Replace emotion words with physiological muscle actions (pupil dilation, jaw clench, breath rate).",
        )
    )

    # 3. Headless sheet law locked
    chars_in_shot = [n.handle for n in shot.spatial_nodes if n.role == "subject"]
    has_char_wardrobe = all(
        any(c.handle == h and len(c.wardrobe_lock.strip()) > 0 for c in project.characters)
        for h in chars_in_shot
    ) if chars_in_shot else (len(project.characters) > 0 and len(project.characters[0].wardrobe_lock.strip()) > 0)
    c3_passed = bool(has_char_wardrobe and ("Headless sheet" in full_compiled_text or "headless" in full_compiled_text.lower() or len(project.characters) > 0))
    checks.append(
        QAAuditItem(
            id="qa-03",
            name="Headless sheet law locked",
            passed=c3_passed,
            detail="Character wardrobe locked and referenced to headless reference sheet." if c3_passed else "Character wardrobe lock missing or headless reference unspecified.",
            remedy="Provide specific wardrobe texture and material lock for active character.",
        )
    )

    # 4. Pupil catch-lights enabled
    eye_keywords = ["pupil", "catch-light", "catch_light", "corneal", "eye", "saccade", "blink"]
    c4_passed = any(k in full_compiled_text.lower() or k in shot.meisner_micro_action.lower() for k in eye_keywords)
    checks.append(
        QAAuditItem(
            id="qa-04",
            name="Pupil catch-lights enabled",
            passed=c4_passed,
            detail="Corneal catch-lights and ocular micro-saccades specified." if c4_passed else "No corneal catch-lights or eye micro-saccade directives found.",
            remedy="Inject pupil dilation or corneal catch-light reflections into micro-expression block.",
        )
    )

    # 5. FOV optical stack >= 4
    optics_keywords = ["anamorphic", "prime", "depth-of-field", "compression", "lens", "bokeh", "distortion", "texture", "optical"]
    matched_optics = sum(1 for k in optics_keywords if k in full_compiled_text.lower())
    c5_passed = matched_optics >= 4
    checks.append(
        QAAuditItem(
            id="qa-05",
            name="FOV optical stack >= 4",
            passed=c5_passed,
            detail=f"Optical stack contains {matched_optics} cinematic optical attributes." if c5_passed else f"Only {matched_optics} optical attributes found; minimum 4 required.",
            remedy="Ensure FOV description includes optical characteristics, anamorphic texture, and perspective compression.",
        )
    )

    # 6. Single light source logic
    lighting_text = f"{project.locations[0].lighting_lock if project.locations else ''} {full_compiled_text}"
    has_lighting = bool(re.search(r"(\d+K|tungsten|key|strip|diffused|lantern|lumens)", lighting_text, re.IGNORECASE))
    c6_passed = has_lighting
    checks.append(
        QAAuditItem(
            id="qa-06",
            name="Single light source logic",
            passed=c6_passed,
            detail="Dominant key lighting source and color temperature locked." if c6_passed else "No clear primary lighting source or temperature defined.",
            remedy="Specify primary directional key light vector and color temperature (e.g. 5600K or 3200K).",
        )
    )

    # 7. Contre-jour shadow side
    has_contre_jour = any(w in full_compiled_text.lower() for w in ["rim", "contre-jour", "shadow", "contrast", "fill", "silhouette"])
    checks.append(
        QAAuditItem(
            id="qa-07",
            name="Contre-jour shadow side",
            passed=has_contre_jour,
            detail="Rim lighting or shadow-side exposure contrast specified." if has_contre_jour else "No contrast or rim lighting vector defined.",
            remedy="Add rim lighting (contre-jour) or negative fill along camera-facing cheek/silhouette.",
        )
    )

    # 8. 180° camera axis respected
    has_180_lock = "180" in full_compiled_text or len(locks.screen_direction_lock.strip()) > 0
    checks.append(
        QAAuditItem(
            id="qa-08",
            name="180° camera axis respected",
            passed=has_180_lock,
            detail="180° camera axis and screen direction locked." if has_180_lock else "180° axis constraint missing.",
            remedy="Lock screen direction (e.g. screen-left to screen-right) and enforce 180° camera axis.",
        )
    )

    # 9. Measurable meter distances
    has_metrics = bool(re.search(r"(\d+(\.\d+)?m|\bscreen-left\b|\bscreen-right\b|\bforeground\b|\bmidground\b)", full_compiled_text, re.IGNORECASE))
    c9_passed = has_metrics and (len(shot.spatial_nodes) > 0 or len(locks.first_frame_lock) > 0)
    checks.append(
        QAAuditItem(
            id="qa-09",
            name="Measurable meter distances",
            passed=c9_passed,
            detail="Spatial blocking contains measurable metric distances and screen planes." if c9_passed else "Spatial positions lack metric coordinates or screen quadrants.",
            remedy="Define spatial nodes with explicit screen horizontal plane and distance in meters.",
        )
    )

    # 10. Red-arrow prop locked
    if project.props or any(n.role == "prop" for n in shot.spatial_nodes):
        prop_locked = any(len(p.material_lock.strip()) > 0 for p in project.props) or "red arrow" in full_compiled_text.lower() or "contact" in full_compiled_text.lower()
    else:
        prop_locked = True
    checks.append(
        QAAuditItem(
            id="qa-10",
            name="Red-arrow prop locked",
            passed=prop_locked,
            detail="Hero prop material and hand contact anchor locked." if prop_locked else "Hero prop exists without material lock or contact sheet anchor.",
            remedy="Define hero prop material lock and designate red-arrow contact anchor.",
        )
    )

    # 11. Meisner action verb obj
    has_meisner = bool(len(shot.meisner_stimulus.strip()) > 0 or len(shot.meisner_micro_action.strip()) > 0)
    checks.append(
        QAAuditItem(
            id="qa-11",
            name="Meisner action verb obj",
            passed=has_meisner,
            detail="Meisner stimulus and active physical micro-action specified." if has_meisner else "Missing Meisner stimulus or micro-action verb.",
            remedy="Add an external stimulus event and immediate physical micro-action response.",
        )
    )

    # 12. Hand business stop cue set
    has_hand_business = bool(
        "hands" in full_compiled_text.lower()
        or "switch" in shot.meisner_micro_action.lower()
        or "grip" in shot.meisner_micro_action.lower()
        or "thumb" in shot.meisner_micro_action.lower()
        or "freeze" in full_compiled_text.lower()
        or "click" in shot.meisner_micro_action.lower()
        or "tactics" in full_compiled_text.lower()
    )
    checks.append(
        QAAuditItem(
            id="qa-12",
            name="Hand business stop cue set",
            passed=has_hand_business,
            detail="Hand action or tactile business has an explicit stop/settle cue." if has_hand_business else "Hand business lacks explicit physical action or stop cue.",
            remedy="Specify what the actor's hands are doing and where they freeze/settle upon line delivery.",
        )
    )

    # 13. Phased micro-blinking on
    has_micro_blinking = any(w in full_compiled_text.lower() for w in ["blink", "saccade", "dilation", "dilate", "catch-light", "gaze", "eyes"])
    checks.append(
        QAAuditItem(
            id="qa-13",
            name="Phased micro-blinking on",
            passed=has_micro_blinking,
            detail="Phased micro-blinking and eye saccade timing defined." if has_micro_blinking else "No micro-blinking or ocular cadence specified.",
            remedy="Add micro-saccades or timed blink cadence (e.g. slow blink at 01.2s, double-blink at 04.5s).",
        )
    )

    # 14. Audio strictly isolated
    has_voice_lock = any(len(c.voice_lock.strip()) > 0 for c in project.characters) or len(shot.dialogue_line.strip()) > 0
    checks.append(
        QAAuditItem(
            id="qa-14",
            name="Audio strictly isolated",
            passed=has_voice_lock,
            detail="Voice timbre/identity locked and dialogue line strictly isolated." if has_voice_lock else "No voice identity or isolated dialogue line found.",
            remedy="Provide voice lock acoustic profile and single spoken dialogue line.",
        )
    )

    # 15. Filler-Babble fix applied
    has_filler_babble = "filler-babble" in full_compiled_text.lower() or "nobody else speaks" in full_compiled_text.lower()
    checks.append(
        QAAuditItem(
            id="qa-15",
            name="Filler-Babble fix applied",
            passed=has_filler_babble,
            detail="Filler-Babble suppression directive active (non-speaking actors remain silent)." if has_filler_babble else "Filler-Babble suppression directive missing in audio block.",
            remedy="Include strict filler-babble directive: 'Nobody else speaks; other visible characters keep lips at rest.'",
        )
    )

    # 16. First-second wide holding
    has_holding = len(locks.first_frame_lock.strip()) > 0 or "first-second" in full_compiled_text.lower() or "first frame" in full_compiled_text.lower()
    checks.append(
        QAAuditItem(
            id="qa-16",
            name="First-second wide holding",
            passed=has_holding,
            detail="First-frame spatial blocking anchor and holding beat locked." if has_holding else "First-frame spatial anchor or holding beat unspecified.",
            remedy="Specify First Frame lock defining actor and camera posture before motion commences.",
        )
    )

    # 17. 3-sentence cap respected
    sentences = re.split(r"[.!?]+", shot.meisner_micro_action)
    non_empty_sent = [s for s in sentences if s.strip()]
    c17_passed = len(non_empty_sent) <= 3
    checks.append(
        QAAuditItem(
            id="qa-17",
            name="3-sentence cap respected",
            passed=c17_passed,
            detail=f"Action beat contains {len(non_empty_sent)} sentences (max 3 allowed)." if c17_passed else f"Action beat contains {len(non_empty_sent)} sentences (> 3 sentences causes model confusion).",
            remedy="Condense action beat to 3 concise, chronological sentences.",
        )
    )

    # 18. States not transitions
    has_monotonic = len(locks.monotonic_state_notes.strip()) > 0 or "monotonic" in full_compiled_text.lower() or "persist" in full_compiled_text.lower()
    checks.append(
        QAAuditItem(
            id="qa-18",
            name="States not transitions",
            passed=has_monotonic,
            detail="Monotonic state accumulation notes locked." if has_monotonic else "Monotonic state notes missing.",
            remedy="Record physical state accumulation notes (e.g. sweat, dust, wounds persist without disappearing).",
        )
    )

    # 19. No stale scene @tags
    used_handles = set(re.findall(r"@[a-zA-Z0-9_]+", f"{shot.title} {shot.dialogue_line} {shot.meisner_stimulus} {shot.meisner_micro_action} {' '.join(n.handle for n in shot.spatial_nodes)} {locks.first_frame_lock}"))
    unknown_handles = used_handles - all_known_handles
    c19_passed = len(unknown_handles) == 0
    checks.append(
        QAAuditItem(
            id="qa-19",
            name="No stale scene @tags",
            passed=c19_passed,
            detail="All @ handles match registered project assets." if c19_passed else f"Unknown or stale handles detected: {list(unknown_handles)}.",
            remedy="Register all referenced handles in ProjectState characters, locations, or props.",
        )
    )

    # 20. Anti-drift negative sealed
    has_negative = bool(len(compiled.negative_prompt.strip()) > 0 or "[15/15]" in full_compiled_text)
    checks.append(
        QAAuditItem(
            id="qa-20",
            name="Anti-drift negative sealed",
            passed=has_negative,
            detail="Anti-drift negative constraints sealed." if has_negative else "Anti-drift negative prompt missing.",
            remedy="Ensure [15/15] NEGATIVE_AND_ANTI_DRIFT_LOCKS contains anti-drift negative constraints.",
        )
    )

    score = sum(1 for c in checks if c.passed)
    all_passed = score == 20

    summary = (
        f"QA Audit PASSED ({score}/20 checks passed)."
        if all_passed
        else f"QA Audit FAILED ({score}/20 checks passed). {20 - score} issues require remediation."
    )

    return QAAuditResult(
        passed=all_passed,
        score=score,
        checks=checks,
        summary=summary,
    )
