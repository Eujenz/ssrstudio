from pathlib import Path
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECTS_DIR = BASE_DIR / "projects"
WEB_DIR = BASE_DIR / "web"
SKILLS_DIR = BASE_DIR / "skills"


class Settings(BaseModel):
    app_title: str = "SSRStudio v2"
    app_version: str = "2.0.0"
    base_dir: Path = BASE_DIR
    projects_dir: Path = PROJECTS_DIR
    web_dir: Path = WEB_DIR
    skills_dir: Path = SKILLS_DIR
    default_aspect_ratio: str = "2.39:1"
    default_canvas_width: int = 1920
    default_canvas_height: int = 804
    default_director_provider: str = "local_deterministic_director"
    default_animatic_provider: str = "local_animatic_slate"


settings = Settings()
