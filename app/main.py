import os
from pathlib import Path
from typing import Optional, Union
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes_assets import router as assets_router
from app.api.routes_compiler import router as compiler_router
from app.api.routes_events import router as events_router
from app.api.routes_projects import router as projects_router
from app.api.routes_wizard import router as wizard_router
from app.config import BASE_DIR, PROJECTS_DIR
from app.core.tool_registry import ToolRegistry
from app.core.workspace import WorkspaceManager


def create_app(projects_dir: Optional[Union[str, Path]] = None) -> FastAPI:
    """FastAPI application factory for SSRStudio v2.

    Initializes routers, mounts static directories, and attaches workspace manager.
    """
    app = FastAPI(
        title="SSRStudio v2 Guided Video Framework",
        version="2.0.0",
        description="Industrial AI video prompt engineering and guided director framework.",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # State initialization
    ws_dir = Path(projects_dir) if projects_dir is not None else PROJECTS_DIR
    ws_dir.mkdir(parents=True, exist_ok=True)
    app.state.workspace_manager = WorkspaceManager(base_dir=ws_dir)
    app.state.tool_registry = ToolRegistry()

    # Register API Routers
    app.include_router(projects_router)
    app.include_router(compiler_router)
    app.include_router(assets_router)
    app.include_router(wizard_router)
    app.include_router(events_router)

    # 1. Health check & Tool list endpoints
    @app.get("/api/health", tags=["system"])
    def health_check():
        return {
            "status": "ok",
            "version": "2.0.0",
            "workspace_dir": str(ws_dir),
        }

    @app.get("/api/tools", tags=["system"])
    def list_tools():
        registry: ToolRegistry = app.state.tool_registry
        return registry.list_tools()

    # 2. Static directory mounts
    # Mount projects static directory for serving rendered slates & assets
    app.mount("/projects", StaticFiles(directory=str(ws_dir)), name="projects")

    # Mount web directory if it exists
    web_dir = BASE_DIR / "web"
    if web_dir.is_dir():
        app.mount("/web", StaticFiles(directory=str(web_dir)), name="web")

    # 3. Root route serving index.html
    @app.get("/", response_class=HTMLResponse, tags=["system"])
    def serve_root():
        index_file = BASE_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))
        return HTMLResponse(
            content="<h1>SSRStudio v2</h1><p>index.html not found in project root.</p>",
            status_code=200,
        )

    return app


app = create_app()
