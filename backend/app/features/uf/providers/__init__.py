"""UF source registry. Order comes from `settings.uf_sources` (csv)."""

from __future__ import annotations

from app.core.config.settings import settings
from app.features.uf.providers.base import (
    SANTIAGO,
    UfProvider,
    UfProviderError,
    UfSeries,
    today_santiago,
    validate_series,
)
from app.features.uf.providers.cmf import CmfProvider
from app.features.uf.providers.mindicador import MindicadorProvider
from app.features.uf.providers.sii import SiiProvider

REGISTRY: dict[str, type[UfProvider]] = {
    "sii": SiiProvider,
    "cmf": CmfProvider,
    "mindicador": MindicadorProvider,
}

DEFAULT_CHAIN = ("sii", "mindicador")


def build_chain() -> list[UfProvider]:
    """Instantiate the configured providers, in order.

    Unknown names are dropped rather than fatal — a typo in an env var must not
    take the UF widget down. If nothing valid is configured, fall back to the
    default chain so the feature always has a source.
    """
    keys = [k.strip().lower() for k in settings.uf_sources.split(",") if k.strip()]
    chain = [REGISTRY[k]() for k in keys if k in REGISTRY]
    if not chain:
        chain = [REGISTRY[k]() for k in DEFAULT_CHAIN]
    return chain


__all__ = [
    "DEFAULT_CHAIN",
    "REGISTRY",
    "SANTIAGO",
    "CmfProvider",
    "MindicadorProvider",
    "SiiProvider",
    "UfProvider",
    "UfProviderError",
    "UfSeries",
    "build_chain",
    "today_santiago",
    "validate_series",
]
