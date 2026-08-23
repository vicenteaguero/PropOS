from __future__ import annotations

from pydantic import BaseModel


class GeoSuggestion(BaseModel):
    """One address a broker can pick, flattened out of GeoJSON."""

    label: str
    # What the event's `location` column gets. Same string as `label` today;
    # kept separate so a future provider can return a longer canonical form.
    address: str
    comuna: str | None = None
    region: str | None = None
    lat: float | None = None
    lon: float | None = None


class GeoAutocompleteResponse(BaseModel):
    items: list[GeoSuggestion]
    # Photon is OpenStreetMap data under ODbL; the attribution has to reach a
    # screen, so it travels with the results rather than living in a constant
    # the frontend might forget to render.
    attribution: str
