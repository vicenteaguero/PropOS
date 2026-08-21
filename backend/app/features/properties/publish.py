"""What a listing must have before it can be published.

`data_health` already counts published properties with no price and no photos,
but counting them is an autopsy: by the time the check runs the listing is
public, a portal may have syndicated it, and someone has seen a blank card. The
same two rules applied at the moment of publishing turn a report into a guard.

Drafts stay unrestricted on purpose — a half-filled draft is the normal way a
property gets loaded, and refusing to save one would break the only workflow
that exists.
"""

from __future__ import annotations

from uuid import UUID

from app.features.properties.photos import MEDIA_ASSETS, TARGET_TABLE


class NotPublishableError(Exception):
    """Raised with a Spanish message the broker can act on, mapped to 409."""

    def __init__(self, reasons: list[str]):
        self.reasons = reasons
        super().__init__(" ".join(reasons))


#: Minimum photos a published listing must carry. One is a low bar deliberately:
#: the point is to stop the empty card, not to enforce a photo shoot.
MIN_PHOTOS = 1


def assert_publishable(client, tenant_id: UUID, property_id: UUID, row: dict) -> None:
    """Raise `NotPublishableError` if this row must not leave draft.

    `row` is the property AS IT WILL BE after the pending update, so a request
    that sets both the price and `is_draft=false` in one call passes.
    """
    reasons: list[str] = []

    if not row.get("list_price_cents"):
        reasons.append("Falta el precio.")

    # Photos are `media_assets` rows pointed at the property through the
    # generic (target_table, target_row_id) pair — there is no property_id
    # column on the table.
    photos = (
        client.table(MEDIA_ASSETS)
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", TARGET_TABLE)
        .eq("target_row_id", str(property_id))
        .limit(MIN_PHOTOS)
        .execute()
        .data
        or []
    )
    if len(photos) < MIN_PHOTOS:
        reasons.append("Falta al menos una foto.")

    if reasons:
        raise NotPublishableError(reasons)
