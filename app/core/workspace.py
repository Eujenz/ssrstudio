import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from app.config import PROJECTS_DIR
from app.models.project import (
    ApprovalGateStatus,
    ContinuityLocks,
    ProjectState,
    ShotSpec,
    SpatialNode,
    StoryFunnel,
)


class WorkspaceManager:
    """Manages project workspaces on the filesystem.

    Directory layout per project:
      <base_dir>/<project_id>/
        ├── project.json
        ├── checkpoints/
        │   └── <timestamp>_<gate>.json
        ├── assets/
        ├── shots/
        ├── renders/
        └── artifacts/
            └── events.jsonl
    """

    def __init__(self, base_dir: Optional[Union[str, Path]] = None) -> None:
        self.base_dir = Path(base_dir) if base_dir is not None else PROJECTS_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_project_dir(self, project_id: str) -> Path:
        return self.base_dir / project_id

    def project_exists(self, project_id: str) -> bool:
        project_file = self.get_project_dir(project_id) / "project.json"
        return project_file.is_file()

    def create_project(
        self,
        title: str,
        idea: str = "",
        funnel: Optional[StoryFunnel] = None,
        shots: Optional[List[ShotSpec]] = None,
    ) -> ProjectState:
        unique_suffix = uuid.uuid4().hex[:8]
        project_id = f"proj-{unique_suffix}"
        proj_dir = self.get_project_dir(project_id)

        # Create standard directory tree
        (proj_dir / "checkpoints").mkdir(parents=True, exist_ok=True)
        (proj_dir / "assets").mkdir(parents=True, exist_ok=True)
        (proj_dir / "shots").mkdir(parents=True, exist_ok=True)
        (proj_dir / "renders").mkdir(parents=True, exist_ok=True)
        (proj_dir / "artifacts").mkdir(parents=True, exist_ok=True)

        # Default initial shot if not provided
        initial_shots = shots
        if initial_shots is None or len(initial_shots) == 0:
            initial_shots = [
                ShotSpec(
                    shot_id="shot-01",
                    scene_id="scene-01",
                    order=1,
                    title="Establishing Hook",
                    duration_sec=10,
                    camera_lens_mm=35,
                    camera_move="Locked-off tripod",
                    spatial_nodes=[
                        SpatialNode(id="sub-1", handle="@protagonist", role="subject", x=0.35, y=0.65, facing_deg=45.0)
                    ],
                    meisner_stimulus="Atmospheric audio pulse echoes in space",
                    meisner_micro_action="Eyes scan the environment, body lowers into defensive stance",
                    dialogue_line="",
                    continuity_locks=ContinuityLocks(
                        first_frame_lock="@protagonist centered at medium distance",
                        screen_direction_lock="Facing screen-right",
                        lens_lock="35mm anamorphic prime",
                        count_lock="1 character in frame",
                        stillness_lock="Background structures rigid",
                        monotonic_state_notes="Initial baseline condition",
                    ),
                )
            ]

        project = ProjectState(
            project_id=project_id,
            title=title,
            idea=idea,
            funnel=funnel or StoryFunnel(),
            shots=initial_shots,
        )

        self.save_project(project)
        self.log_event(project_id, "project_created", {"title": title, "idea": idea})
        return project

    def save_project(self, project: ProjectState) -> None:
        proj_dir = self.get_project_dir(project.project_id)
        proj_dir.mkdir(parents=True, exist_ok=True)
        project.updated_at = datetime.now(timezone.utc).isoformat()

        target_file = proj_dir / "project.json"
        data = project.model_dump(mode="json")
        target_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def load_project(self, project_id: str) -> ProjectState:
        target_file = self.get_project_dir(project_id) / "project.json"
        if not target_file.is_file():
            raise FileNotFoundError(f"Project '{project_id}' not found at {target_file}")

        data = json.loads(target_file.read_text(encoding="utf-8"))
        return ProjectState.model_validate(data)

    def list_projects(self) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        if not self.base_dir.exists():
            return results

        for p in self.base_dir.iterdir():
            if p.is_dir():
                project_json = p / "project.json"
                if project_json.is_file():
                    try:
                        data = json.loads(project_json.read_text(encoding="utf-8"))
                        results.append({
                            "project_id": data.get("project_id", p.name),
                            "title": data.get("title", ""),
                            "idea": data.get("idea", ""),
                            "updated_at": data.get("updated_at", ""),
                            "shot_count": len(data.get("shots", [])),
                            "gates": data.get("gates", {}),
                        })
                    except Exception:
                        continue

        results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return results

    def delete_project(self, project_id: str) -> bool:
        proj_dir = self.get_project_dir(project_id)
        if proj_dir.is_dir():
            shutil.rmtree(proj_dir)
            return True
        return False

    def update_gate(
        self,
        project_id: str,
        gate_name: str,
        status: ApprovalGateStatus,
        reason: str = "",
    ) -> ProjectState:
        project = self.load_project(project_id)
        project.gates[gate_name] = status
        self.save_project(project)

        # Create checkpoint file: checkpoints/<timestamp>_<gate>.json
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        checkpoint_name = f"{timestamp}_{gate_name}.json"
        checkpoint_path = self.get_project_dir(project_id) / "checkpoints" / checkpoint_name
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        checkpoint_path.write_text(
            json.dumps(project.model_dump(mode="json"), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        self.log_event(
            project_id,
            event_type="gate_status_updated",
            data={
                "gate": gate_name,
                "status": status.value if hasattr(status, "value") else str(status),
                "reason": reason,
                "checkpoint": checkpoint_name,
            },
        )
        return project

    def log_event(self, project_id: str, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        proj_dir = self.get_project_dir(project_id)
        artifacts_dir = proj_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        events_file = artifacts_dir / "events.jsonl"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "project_id": project_id,
            "data": data,
        }
        with open(events_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

        return event

    def get_events(self, project_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        events_file = self.get_project_dir(project_id) / "artifacts" / "events.jsonl"
        if not events_file.is_file():
            return []

        lines = events_file.read_text(encoding="utf-8").strip().splitlines()
        events = []
        for line in lines[-limit:]:
            if line.strip():
                try:
                    events.append(json.loads(line))
                except Exception:
                    continue
        return events

    def list_checkpoints(self, project_id: str) -> List[Dict[str, Any]]:
        checkpoints_dir = self.get_project_dir(project_id) / "checkpoints"
        if not checkpoints_dir.is_dir():
            return []

        files = sorted(checkpoints_dir.glob("*.json"), reverse=True)
        return [{"filename": f.name, "path": str(f)} for f in files]
