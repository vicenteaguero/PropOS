"""Route declaration order, which FastAPI decides by position, not specificity.

`/contacts/duplicates` shipped broken for exactly one commit: it was declared
after `/contacts/{contact_id}`, so the literal segment was parsed as a uuid and
every call came back 422. Nothing about the code looks wrong — the bug lives in
the ORDER — which is why it needs a test rather than a comment.
"""

from __future__ import annotations

from app.features.contacts.router import router

#: Literal paths that must be declared before the uuid route that would
#: otherwise capture them.
LITERAL_PATHS = ["/contacts/duplicates"]


def _paths_in_order() -> list[str]:
    return [route.path for route in router.routes]


def test_literal_paths_are_declared_before_the_uuid_route() -> None:
    paths = _paths_in_order()
    catch_all = paths.index("/contacts/{contact_id}")
    for literal in LITERAL_PATHS:
        assert paths.index(literal) < catch_all, (
            f"{literal} is declared after /contacts/{{contact_id}} and will be parsed as a uuid"
        )
