"""Provider contract + shared sanity guards for UF sources.

The UF is calculated and published by the Banco Central de Chile (Ley 18.010
art. 35). SII, CMF and mindicador.cl all republish that same number, so a
provider chain is a pure availability play, not a data-quality tradeoff: any
provider that answers returns the same series.

What differs between them is coverage. SII and CMF publish the *forward* block
(the UF is fixed on the 9th of each month for the following 10th → 9th window),
while mindicador's default endpoint stops at today. That is why SII leads the
default chain.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from zoneinfo import ZoneInfo

# UF is a Chile-local daily indicator; "today" must be America/Santiago, not UTC
# (after ~20:00 local the UTC date is already tomorrow → wrong/missing UF row).
SANTIAGO = ZoneInfo("America/Santiago")

HTTP_TIMEOUT = 10.0

# Sanity band. The UF crossed 1.000 CLP in 1980 and sits around 40.000 in 2026;
# it is indexed to CPI and never falls hard, so this band holds for decades in
# either direction while still catching a parser that read a day number, a
# percentage, or a thousands separator as the value.
MIN_PLAUSIBLE_CLP = 1_000.0
MAX_PLAUSIBLE_CLP = 1_000_000.0

# The UF moves with monthly CPI spread over 30 days. Even a 10%/month inflation
# shock is ~0.32%/day, so 0.5%/day is a generous ceiling that still rejects a
# misparsed row (e.g. a column shifted by one month).
MAX_DAILY_DRIFT_PCT = 0.005


class UfProviderError(RuntimeError):
    """A provider could not deliver a usable series (HTTP, parse or sanity)."""


UfSeries = list[tuple[date, float]]


def today_santiago() -> date:
    return datetime.now(SANTIAGO).date()


def validate_series(points: UfSeries, *, source: str) -> UfSeries:
    """Sort, dedupe and sanity-check a provider's series.

    Raises UfProviderError so the caller can fall through to the next provider
    instead of persisting garbage. An empty input is *not* an error here — a
    year page for a year that has not started yet is legitimately empty; the
    caller decides whether empty is acceptable.
    """
    if not points:
        return []

    by_date: dict[date, float] = {}
    for d, value in points:
        if not (MIN_PLAUSIBLE_CLP < value < MAX_PLAUSIBLE_CLP):
            raise UfProviderError(f"{source}: implausible UF value {value} on {d}")
        previous = by_date.get(d)
        if previous is not None and abs(previous - value) > 0.001:
            raise UfProviderError(f"{source}: conflicting values for {d} ({previous} vs {value})")
        by_date[d] = value

    ordered = sorted(by_date.items())
    for (prev_date, prev_value), (cur_date, cur_value) in zip(ordered, ordered[1:], strict=False):
        days = (cur_date - prev_date).days
        if days <= 0 or prev_value <= 0:
            continue
        drift = abs(cur_value - prev_value) / prev_value / days
        if drift > MAX_DAILY_DRIFT_PCT:
            raise UfProviderError(
                f"{source}: implausible drift {drift * 100:.3f}%/day "
                f"between {prev_date} ({prev_value}) and {cur_date} ({cur_value})"
            )
    return ordered


def parse_clp(raw: str) -> float:
    """Parse a Chilean-formatted amount: '40.856,64' → 40856.64."""
    cleaned = raw.strip().replace(".", "").replace(",", ".")
    if not cleaned:
        raise ValueError("empty amount")
    return float(cleaned)


class UfProvider(ABC):
    """One UF source. Providers are stateless and cheap to construct."""

    name: str

    @abstractmethod
    async def fetch_year(self, year: int) -> UfSeries:
        """Every published value for `year`. Empty list if the year is unpublished."""

    async def fetch_recent(self) -> UfSeries:
        """Values around today, including any published forward block.

        Default is the current year's page — providers with a cheaper
        "last N days" endpoint override this.
        """
        return await self.fetch_year(today_santiago().year)
