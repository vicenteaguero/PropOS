from __future__ import annotations

from app.features.documents.schemas import StubResult


def scrape_url(_url: str) -> StubResult:
    """V1 stub. V2: descarga + sanitización + conversión a PDF."""
    return StubResult(plugin="scrape", detail="Web scraping import not implemented in V1")
