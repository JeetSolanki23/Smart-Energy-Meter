from types import SimpleNamespace

from app.services import runtime_config_service


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


def test_get_device_data_interval_returns_latest_value() -> None:
    db = _DBStub(row=SimpleNamespace(device_data_interval_seconds=45))

    interval = runtime_config_service.get_device_data_interval_seconds(db)

    assert interval == 45


def test_get_device_data_interval_falls_back_to_settings_default() -> None:
    db = _DBStub(row=None)

    interval = runtime_config_service.get_device_data_interval_seconds(db)

    assert interval == int(runtime_config_service.settings.DEVICE_DATA_INTERVAL_SECONDS)


def test_set_device_data_interval_persists_row_and_returns_value() -> None:
    db = _DBStub()

    value = runtime_config_service.set_device_data_interval_seconds(db, 60)

    assert value == 60
    assert db.committed is True
    assert len(db.added) == 1
