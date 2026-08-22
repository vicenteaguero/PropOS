"""The thumbnail backfill must actually reach the end of the table.

PostgREST caps a response at 1000 rows and says nothing when it truncates, so a
query with no explicit range looks successful while covering only the first
page. A backfill that silently stops at 1000 is worse than one that crashes: it
reports "Done" and leaves the rest of the tenant without thumbnails.
"""

from scripts.backfill_thumbnails import PAGE, _chunked, _page_all


class _FakeQuery:
    """Mimics PostgREST: `range` is honoured, and a page is capped at PAGE."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._start = 0
        self._end = len(rows)

    def range(self, start: int, end: int) -> "_FakeQuery":
        self._start = start
        self._end = min(end + 1, start + PAGE)
        return self

    def execute(self) -> "_FakeQuery":
        return self

    @property
    def data(self) -> list[dict]:
        return self._rows[self._start : self._end]


def _rows(n: int) -> list[dict]:
    return [{"id": i} for i in range(n)]


def test_page_all_reads_past_the_first_page() -> None:
    rows = _rows(2500)
    got = _page_all(lambda: _FakeQuery(rows), None)
    assert len(got) == 2500
    assert got[-1]["id"] == 2499


def test_page_all_stops_on_a_short_page() -> None:
    """A partial page means the end of the table; do not spin forever."""
    rows = _rows(PAGE + 7)
    assert len(_page_all(lambda: _FakeQuery(rows), None)) == PAGE + 7


def test_page_all_honours_limit_across_pages() -> None:
    assert len(_page_all(lambda: _FakeQuery(_rows(5000)), 1500)) == 1500


def test_page_all_limit_below_one_page() -> None:
    assert len(_page_all(lambda: _FakeQuery(_rows(5000)), 10)) == 10


def test_page_all_on_empty_table() -> None:
    assert _page_all(lambda: _FakeQuery([]), None) == []


def test_chunked_splits_ids_for_the_in_filter() -> None:
    chunks = list(_chunked(list(range(450)), size=200))
    assert [len(c) for c in chunks] == [200, 200, 50]
