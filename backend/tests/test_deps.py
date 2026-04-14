from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.core import deps
from app.models.admin import Admin
from app.models.device import Device
from app.models.user import User


class _QueryStub:
    def __init__(self, result: object | None):
        self._result = result

    def filter(self, *_args: object, **_kwargs: object) -> "_QueryStub":
        return self

    def first(self) -> object | None:
        return self._result


class _DBStub:
    def __init__(self, results: dict[type[object], object | None]):
        self._results = results

    def query(self, model: type[object]) -> _QueryStub:
        return _QueryStub(self._results.get(model))


def test_get_current_user_returns_user(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id="user-1", email="u@example.com")
    db = _DBStub({User: user})

    monkeypatch.setattr(deps, "decode_access_token", lambda _token: {"sub": "user-1", "role": "user"})

    current = deps.get_current_user(token="token", db=db)

    assert current is user


def test_get_current_user_rejects_non_user_role(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DBStub({})
    monkeypatch.setattr(deps, "decode_access_token", lambda _token: {"sub": "admin-1", "role": "admin"})

    with pytest.raises(HTTPException) as exc_info:
        deps.get_current_user(token="token", db=db)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_get_current_admin_returns_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    admin = SimpleNamespace(id="admin-1", email="a@example.com")
    db = _DBStub({Admin: admin})

    monkeypatch.setattr(deps, "decode_access_token", lambda _token: {"sub": "admin-1", "role": "admin"})

    current = deps.get_current_admin(token="token", db=db)

    assert current is admin


def test_get_current_admin_rejects_missing_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DBStub({Admin: None})
    monkeypatch.setattr(deps, "decode_access_token", lambda _token: {"sub": "admin-1", "role": "admin"})

    with pytest.raises(HTTPException) as exc_info:
        deps.get_current_admin(token="token", db=db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_authenticated_device_requires_bearer_header() -> None:
    db = _DBStub({})

    with pytest.raises(HTTPException) as exc_info:
        deps.get_authenticated_device(authorization="", db=db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_authenticated_device_returns_device() -> None:
    device = SimpleNamespace(id="device-1")
    db = _DBStub({Device: device})

    current = deps.get_authenticated_device(authorization="Bearer secret-token", db=db)

    assert current is device
