from __future__ import annotations

from app.features.documents.schemas import StubResult


def sign_document(_path: str, _signer_email: str) -> StubResult:
    """V1 stub. V2: integración DocuSign / FirmaVirtual.cl / e-Cert."""
    return StubResult(plugin="sign", detail="Digital signing not implemented in V1")
