from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.dependencies import require_role

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    dependencies=[Depends(require_role("ADMIN", "AGENT"))],
)
