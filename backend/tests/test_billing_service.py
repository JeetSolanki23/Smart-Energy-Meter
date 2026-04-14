from datetime import date
from types import SimpleNamespace

from app.models.enums import BillStatus
from app.services import billing_service


class _QueryStub:
    def __init__(self, rows: list[object]):
        self._rows = rows

    def filter(self, *_args: object, **_kwargs: object) -> "_QueryStub":
        return self

    def all(self) -> list[object]:
        return self._rows


class _DBStub:
    def __init__(self, rows: list[object]):
        self._rows = rows
        self.committed = False

    def query(self, _model: object) -> _QueryStub:
        return _QueryStub(self._rows)

    def commit(self) -> None:
        self.committed = True


def test_mark_overdue_bills_updates_status_and_returns_count() -> None:
    unpaid1 = SimpleNamespace(status=BillStatus.UNPAID, due_date=date(2024, 1, 1))
    unpaid2 = SimpleNamespace(status=BillStatus.UNPAID, due_date=date(2024, 1, 2))
    db = _DBStub(rows=[unpaid1, unpaid2])

    count = billing_service.mark_overdue_bills(db, today=date(2024, 2, 1))

    assert count == 2
    assert unpaid1.status == BillStatus.OVERDUE
    assert unpaid2.status == BillStatus.OVERDUE
    assert db.committed is True


def test_mark_overdue_bills_handles_empty_list() -> None:
    db = _DBStub(rows=[])

    count = billing_service.mark_overdue_bills(db, today=date(2024, 2, 1))

    assert count == 0
    assert db.committed is True
