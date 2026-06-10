"""Pure financial helpers. No I/O — trivially unit-testable."""

from __future__ import annotations

DEFAULT_IVA_PCT = 19.0


def commission(amount_cents: int, rate_pct: float, iva_pct: float = DEFAULT_IVA_PCT) -> dict[str, int]:
    """Broker commission on a deal value.

    net   = amount * rate%
    iva   = net * iva%   (Chile: 19% IVA on the service fee)
    gross = net + iva

    All returned values are integer cents (banker-free round-half-up via int()).
    """
    net = round(amount_cents * (rate_pct / 100.0))
    iva = round(net * (iva_pct / 100.0))
    return {"net_cents": int(net), "iva_cents": int(iva), "gross_cents": int(net + iva)}
