"""
Project store — persistent JSON-file storage for OrgProject / ProjectTask.

Each organisation has its own ``projects.json`` under ``data/orgs/<org_id>/``.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from openakita.orgs.models import OrgProject, ProjectTask, _now_iso

logger = logging.getLogger(__name__)


class ProjectStore:
    """Simple JSON-backed project store, one file per org."""

    def __init__(self, org_dir: Path) -> None:
        self._path = org_dir / "projects.json"
        self._projects: dict[str, OrgProject] = {}
        self._mtime: float = 0.0
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _file_mtime(self) -> float:
        try:
            return self._path.stat().st_mtime
        except FileNotFoundError:
            return 0.0

    def _reload_if_changed(self) -> None:
        """Re-read from disk if another process/instance modified the file."""
        mt = self._file_mtime()
        if mt > self._mtime:
            self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text("utf-8"))
            self._projects = {}
            for raw in data:
                proj = OrgProject.from_dict(raw)
                self._projects[proj.id] = proj
            self._mtime = self._file_mtime()
        except Exception as exc:
            logger.warning("Failed to load projects from %s: %s", self._path, exc)

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = [p.to_dict() for p in self._projects.values()]
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf-8")
        tmp.replace(self._path)

    # ------------------------------------------------------------------
    # Project CRUD
    # ------------------------------------------------------------------

    def list_projects(self) -> list[OrgProject]:
        self._reload_if_changed()
        return list(self._projects.values())

    def get_project(self, project_id: str) -> OrgProject | None:
        self._reload_if_changed()
        return self._projects.get(project_id)

    def create_project(self, proj: OrgProject) -> OrgProject:
        self._projects[proj.id] = proj
        self._save()
        return proj

    def update_project(self, project_id: str, updates: dict) -> OrgProject | None:
        proj = self._projects.get(project_id)
        if not proj:
            return None
        for key, val in updates.items():
            if key == "tasks":
                continue
            if hasattr(proj, key):
                setattr(proj, key, val)
        proj.updated_at = _now_iso()
        self._save()
        return proj

    def delete_project(self, project_id: str) -> bool:
        if project_id not in self._projects:
            return False
        del self._projects[project_id]
        self._save()
        return True

    # ------------------------------------------------------------------
    # Task CRUD
    # ------------------------------------------------------------------

    def add_task(self, project_id: str, task: ProjectTask) -> ProjectTask | None:
        proj = self._projects.get(project_id)
        if not proj:
            return None
        task.project_id = project_id
        proj.tasks.append(task)
        proj.updated_at = _now_iso()
        self._save()
        return task

    def update_task(self, project_id: str, task_id: str, updates: dict) -> ProjectTask | None:
        proj = self._projects.get(project_id)
        if not proj:
            return None
        for t in proj.tasks:
            if t.id == task_id:
                for key, val in updates.items():
                    if hasattr(t, key):
                        setattr(t, key, val)
                proj.updated_at = _now_iso()
                self._save()
                return t
        return None

    def delete_task(self, project_id: str, task_id: str) -> bool:
        proj = self._projects.get(project_id)
        if not proj:
            return False
        before = len(proj.tasks)
        proj.tasks = [t for t in proj.tasks if t.id != task_id]
        if len(proj.tasks) < before:
            proj.updated_at = _now_iso()
            self._save()
            return True
        return False

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def all_tasks(
        self,
        status: str | None = None,
        assignee: str | None = None,
        chain_id: str | None = None,
    ) -> list[dict]:
        """Flat list of tasks across all projects, with optional filters."""
        self._reload_if_changed()
        result: list[dict] = []
        for proj in self._projects.values():
            for t in proj.tasks:
                if status and t.status.value != status:
                    continue
                if assignee and t.assignee_node_id != assignee:
                    continue
                if chain_id and t.chain_id != chain_id:
                    continue
                d = t.to_dict()
                d["project_name"] = proj.name
                d["project_type"] = proj.project_type.value
                result.append(d)
        return result

    def find_task_by_chain(self, chain_id: str) -> ProjectTask | None:
        """Find a task by its task_chain_id across all projects."""
        self._reload_if_changed()
        for proj in self._projects.values():
            for t in proj.tasks:
                if t.chain_id == chain_id:
                    return t
        return None
