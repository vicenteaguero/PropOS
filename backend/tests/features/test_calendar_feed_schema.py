"""The calendar feed's response model must not silently drop columns.

`GET /v1/events/calendar` declares `response_model=list[CalendarItem]`, and a
FastAPI response model is a filter as much as a contract: any key the model does
not declare is removed from the payload without an error anywhere. `location`
was added to `v_calendar_feed` in migration 20240601000070 and consumed by the
Home widget, but never declared here, so the address was stripped from every
response and the "cómo llegar" button could never render.
"""

from uuid import uuid4

from app.features.events.schemas import CalendarItem


def _row(**overrides: object) -> dict:
    row = {
        "tenant_id": str(uuid4()),
        "item_type": "EVENT",
        "id": str(uuid4()),
        "title": "Visita Macul",
        "location": "Av. Macul 1234, Macul",
    }
    row.update(overrides)
    return row


def test_calendar_item_preserves_location() -> None:
    assert CalendarItem(**_row()).location == "Av. Macul 1234, Macul"


def test_calendar_item_location_survives_serialisation() -> None:
    """Round-trip through the model the way the response layer does."""
    dumped = CalendarItem(**_row()).model_dump()
    assert dumped["location"] == "Av. Macul 1234, Macul"


def test_calendar_item_location_is_optional() -> None:
    """TASK and PAYMENT rows select NULL::TEXT for location."""
    assert CalendarItem(**_row(item_type="TASK", location=None)).location is None
