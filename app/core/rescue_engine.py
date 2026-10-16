import difflib
import re
from typing import Dict, List, Tuple

from app.models.compiler import SingleVariableDiffResult, StopLossResult


def _parse_structured_sections(prompt: str) -> Dict[str, str]:
    """
    Parses structured 10-section or 15-block prompts into a key-value dictionary.
    Recognizes lines like:
      - 'GLOBAL STYLE: Neo-Noir Cyberpunk'
      - '[01/15] Aspect Ratio & Camera Setup: ...'
    """
    sections: Dict[str, str] = {}
    current_key = ""
    current_lines: List[str] = []

    header_pattern = re.compile(
        r"^(\[[0-9]{2}/[0-9]{2}\][^:\n]+|[A-Z0-9_\-\s]+):(?:\s*(.*))?$"
    )

    for line in prompt.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue

        match = header_pattern.match(trimmed)
        if match:
            if current_key:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = match.group(1).strip()
            initial_val = match.group(2)
            current_lines = [initial_val.strip()] if initial_val else []
        elif current_key:
            current_lines.append(trimmed)
        else:
            current_lines.append(trimmed)

    if current_key:
        sections[current_key] = "\n".join(current_lines).strip()

    return sections


def analyze_single_variable_diff(prev_prompt: str, curr_prompt: str) -> SingleVariableDiffResult:
    """
    Enforces Higgsfield Single-Variable Testing discipline:
    Compares two iteration prompts and detects whether strictly 1 variable was modified.
    Multi-variable modifications (>1 variable changed simultaneously) are rejected
    to prevent prompt drift and compounding hallucination.
    """
    prev_clean = prev_prompt.strip()
    curr_clean = curr_prompt.strip()

    if prev_clean == curr_clean:
        return SingleVariableDiffResult(
            is_single_variable=False,
            diff_count=0,
            diff_summary="No changes detected between prompts.",
            changed_keys=[],
        )

    # 1. Check for structured sections (10-Section or 15-Block)
    prev_sections = _parse_structured_sections(prev_clean)
    curr_sections = _parse_structured_sections(curr_clean)

    if len(prev_sections) >= 2 and len(curr_sections) >= 2:
        all_keys = list(dict.fromkeys(list(prev_sections.keys()) + list(curr_sections.keys())))
        changed_sections: List[str] = []

        for key in all_keys:
            val_prev = prev_sections.get(key, "").strip()
            val_curr = curr_sections.get(key, "").strip()
            if val_prev != val_curr:
                changed_sections.append(key)

        diff_count = len(changed_sections)
        is_single = diff_count == 1
        summary = (
            f"Single section modified: '{changed_sections[0]}'"
            if is_single
            else f"Multi-variable contamination: {diff_count} sections modified ({', '.join(changed_sections)})"
        )
        return SingleVariableDiffResult(
            is_single_variable=is_single,
            diff_count=diff_count,
            diff_summary=summary,
            changed_keys=changed_sections,
        )

    # 2. Token / word-cluster sequence diffing for unstructured prompts
    prev_words = prev_clean.split()
    curr_words = curr_clean.split()

    matcher = difflib.SequenceMatcher(None, prev_words, curr_words)
    opcodes = [op for op in matcher.get_opcodes() if op[0] != "equal"]

    diff_count = len(opcodes)
    is_single = diff_count == 1

    changed_keys: List[str] = []
    for tag, i1, i2, j1, j2 in opcodes:
        w_prev = " ".join(prev_words[i1:i2]) or "(none)"
        w_curr = " ".join(curr_words[j1:j2]) or "(none)"
        changed_keys.append(f"{w_prev} -> {w_curr}")

    if is_single:
        summary = f"Single variable modified: {changed_keys[0]}"
    elif diff_count == 0:
        summary = "No token differences found."
    else:
        summary = f"Multi-variable contamination detected: {diff_count} independent token edits ({'; '.join(changed_keys)})."

    return SingleVariableDiffResult(
        is_single_variable=is_single,
        diff_count=diff_count,
        diff_summary=summary,
        changed_keys=changed_keys,
    )


def _get_surgical_patch_recommendation(failure_type: str) -> str:
    """Returns domain-informed surgical prompt adjustment advice for common AI video failure modes."""
    ft = failure_type.lower()
    if any(k in ft for k in ["hand", "prop", "grip", "clipping"]):
        return (
            "Render high-contrast #FF0000 red-arrow contact sheet on base image; "
            "isolate hand-prop contact coordinate anchor in Meisner micro-action."
        )
    if any(k in ft for k in ["physics", "collapse", "melting", "drift"]):
        return (
            "Lock camera to stationary tripod; reduce Meisner micro-action movement speed; "
            "enforce stillness lock on background geometry."
        )
    if any(k in ft for k in ["anatomy", "morphing", "face", "identity"]):
        return (
            "Apply headless character turnaround crop (top 22% stripped); "
            "remove facial descriptor tokens to lock wardrobe and body proportions."
        )
    if any(k in ft for k in ["lighting", "flicker", "shadow"]):
        return (
            "Lock key light angle and color temperature (e.g. 5600K); "
            "eliminate ambient mood adjectives."
        )
    return (
        f"Freeze all camera, lens, and lighting parameters; modify only the single clause addressing '{failure_type}'."
    )


def evaluate_stop_loss(iteration_count: int, failure_type: str = "generic_distortion") -> StopLossResult:
    """
    Enforces the Higgsfield 10-15 iteration stop-loss rule:
      - < 10 iterations: Targeted surgical prompt patch recommendation (CONTINUE).
      - 10 to 14 iterations: Warning SIMPLIFY_BLOCKING_OR_REANCHOR (split shot to 5s, re-anchor first frame).
      - >= 15 iterations: Halt INSERT_REACTION_BRIDGE_SHOT with concrete 0.8s reaction/bridge shot insertion spec.
    """
    if iteration_count < 10:
        recommendation = _get_surgical_patch_recommendation(failure_type)
        return StopLossResult(
            iteration_count=iteration_count,
            action="CONTINUE",
            bridge_shot_suggestion="",
            message=(
                f"Iteration {iteration_count} of 15 (within single-variable budget). "
                f"Targeted surgical prompt patch recommended for '{failure_type}': {recommendation}"
            ),
        )

    if 10 <= iteration_count < 15:
        return StopLossResult(
            iteration_count=iteration_count,
            action="SIMPLIFY_BLOCKING_OR_REANCHOR",
            bridge_shot_suggestion="",
            message=(
                f"Warning: Iteration count is {iteration_count}/15. Stop-loss rule triggered: "
                "SIMPLIFY_BLOCKING_OR_REANCHOR. Split shot duration to 5s, simplify complex spatial blocking, "
                "and re-anchor first frame using a high-fidelity reference slate to eliminate compounding hallucinations."
            ),
        )

    # >= 15 iterations: Hard halt
    bridge_spec = (
        "INSERT 0.8s BRIDGE REACTION SHOT: Cut immediately to an 85mm Extreme Close-Up (ECU) "
        "on character eyeline, hand gesture, or environmental cutaway for exactly 0.8s (20 frames at 24fps). "
        "Severing continuous physics momentum breaks model hallucination loops, resetting spatial drift "
        "and enabling clean re-anchoring of subsequent blocking."
    )
    return StopLossResult(
        iteration_count=iteration_count,
        action="INSERT_REACTION_BRIDGE_SHOT",
        bridge_shot_suggestion=bridge_spec,
        message=(
            f"HALT: Iteration count is {iteration_count} (>= 15). Stop-loss limit reached. "
            "Cease iterative prompt grinding. INSERT_REACTION_BRIDGE_SHOT immediately to reset physics collapse."
        ),
    )
