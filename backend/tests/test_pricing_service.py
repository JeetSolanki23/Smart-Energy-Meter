from types import SimpleNamespace

from app.services import pricing_service


class _QueryStub:
    def __init__(self, row: object | None):
        self._row = row

    def order_by(self, *_args: object, **_kwargs: object) -> "_QueryStub":
        return self

    def first(self) -> object | None:
        return self._row


class _DBStub:
    def __init__(self, row: object | None = None):
        self._row = row
        self.added: list[object] = []
        self.committed = False

    def query(self, _model: object) -> _QueryStub:
        return _QueryStub(self._row)

    def add(self, item: object) -> None:
        self.added.append(item)

    def commit(self) -> None:
        self.committed = True


def test_get_current_price_returns_latest_db_value() -> None:
    db = _DBStub(row=SimpleNamespace(price_per_unit=9.5))

    price = pricing_service.get_current_price(db)

    assert price == 9.5


def test_get_current_price_falls_back_to_settings_default() -> None:
    db = _DBStub(row=None)

    price = pricing_service.get_current_price(db)

    assert price == float(pricing_service.settings.PRICE_PER_UNIT)


def test_set_current_price_persists_row_and_returns_value() -> None:
    db = _DBStub()

    value = pricing_service.set_current_price(db, 8.75)

    assert value == 8.75
    assert db.committed is True
    assert len(db.added) == 1
