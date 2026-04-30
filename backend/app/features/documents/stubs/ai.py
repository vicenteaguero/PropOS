from __future__ import annotations

from app.features.documents.schemas import StubResult


def analyze_document(_path: str, _prompt: str | None = None) -> StubResult:
    """V1 stub. V2: conectar Claude API o GPT-4 vision para análisis."""
    return StubResult(plugin="ai_vision", detail="AI analysis not implemented in V1")
