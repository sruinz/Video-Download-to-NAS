from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

try:
    import yt_dlp  # noqa: F401
except ModuleNotFoundError:
    sys.modules["yt_dlp"] = SimpleNamespace(YoutubeDL=None)

try:
    import jose  # noqa: F401
except ModuleNotFoundError:
    sys.modules["jose"] = SimpleNamespace(JWTError=Exception, jwt=SimpleNamespace())

try:
    import passlib.context  # noqa: F401
except ModuleNotFoundError:
    class _DummyCryptContext:
        def __init__(self, *args, **kwargs):
            pass
    sys.modules["passlib"] = SimpleNamespace(context=SimpleNamespace(CryptContext=_DummyCryptContext))
    sys.modules["passlib.context"] = SimpleNamespace(CryptContext=_DummyCryptContext)

with patch("os.makedirs"):
    from app import downloader
from app.database import Base, DownloadedFile, User
from app.migrations import migrate_memo_and_description_schema
from app.models import FileInfo, FileMemoUpdate, SaveSettingsUpdate
from app.routers.users import get_save_settings, update_save_settings


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(test_db):
    user = User(
        username="memotester",
        hashed_password="not-used",
        folder_organization_mode="root",
        auto_save_description=0,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


def test_메모_및_설명_마이그레이션은_기존_DB에_멱등하게_적용된다():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(50))"))
        conn.execute(text("CREATE TABLE downloaded_files (id INTEGER PRIMARY KEY, filename VARCHAR(255))"))
    session = sessionmaker(bind=engine)()
    try:
        first = migrate_memo_and_description_schema(session)
        second = migrate_memo_and_description_schema(session)

        assert first["success"] is True
        assert first["added_columns"] == 2
        assert second["success"] is True
        assert second["added_columns"] == 0
    finally:
        session.close()


def test_저장_설정_기본값은_OFF이고_토글_저장이_동작한다(test_db, test_user):
    initial = asyncio.run(get_save_settings(current_user=test_user))
    assert initial.auto_save_description is False

    enabled = asyncio.run(
        update_save_settings(
            SaveSettingsUpdate(auto_save_description=True),
            current_user=test_user,
            db=test_db,
        )
    )
    assert enabled.auto_save_description is True
    assert test_user.auto_save_description == 1

    disabled = asyncio.run(
        update_save_settings(
            SaveSettingsUpdate(auto_save_description=False),
            current_user=test_user,
            db=test_db,
        )
    )
    assert disabled.auto_save_description is False
    assert test_user.auto_save_description == 0


def test_설명_자동저장이_OFF일때는_description을_저장하지_않는다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        video_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "tutorial_off")
            .replace("%(ext)s", "mp4")
        )
        video_path.parent.mkdir(parents=True, exist_ok=True)
        video_path.write_bytes(b"video-data")
        return {
            "filename": str(video_path),
            "filesize": 10,
            "thumbnail": None,
            "duration": 60,
            "title": "tutorial_off",
            "description": "설치 링크: https://example.com/guide",
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(
            notification_manager=SimpleNamespace(
                send_download_complete_notification=ignore_notification,
                send_download_failed_notification=ignore_notification,
            )
        ),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/watch?v=desc_off",
            "best",
            "dl-desc-off",
            test_db,
            test_user.id,
        )
    )

    assert result["status"] == "success"
    record = test_db.query(DownloadedFile).one()
    assert record.memo is None


def test_설명_자동저장이_ON이면_yt_dlp_설명을_초기값으로_저장하고_기존_사용자_메모는_보호한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    test_user.auto_save_description = 1
    test_db.commit()
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    long_desc = "설치 명령어:\ndocker compose up -d\nhttps://github.com/example/repo\n" + ("A" * 12000)

    def fake_download(ydl_opts, _url):
        video_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "tutorial_on")
            .replace("%(ext)s", "mp4")
        )
        video_path.parent.mkdir(parents=True, exist_ok=True)
        video_path.write_bytes(b"video-data")
        return {
            "filename": str(video_path),
            "filesize": 10,
            "thumbnail": None,
            "duration": 60,
            "title": "tutorial_on",
            "description": long_desc,
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(
            notification_manager=SimpleNamespace(
                send_download_complete_notification=ignore_notification,
                send_download_failed_notification=ignore_notification,
            )
        ),
    )

    # 1차 다운로드: description 자동 저장 + 10,000자 제한
    res1 = asyncio.run(
        downloader.download_video(
            "https://media.example/watch?v=desc_on",
            "best",
            "dl-desc-on-1",
            test_db,
            test_user.id,
        )
    )
    assert res1["status"] == "success"
    record = test_db.query(DownloadedFile).one()
    assert record.memo is not None
    assert record.memo.startswith("설치 명령어:")
    assert len(record.memo) == 10000

    # 사용자가 직접 메모를 정리/수정
    record.memo = "내가 정리한 핵심 명령어만 남김"
    test_db.commit()

    # 동일 URL 재다운로드 시 사용자가 수정한 메모를 덮어쓰지 않아야 함
    res2 = asyncio.run(
        downloader.download_video(
            "https://media.example/watch?v=desc_on",
            "best",
            "dl-desc-on-2",
            test_db,
            test_user.id,
        )
    )
    assert res2["status"] == "success"
    test_db.refresh(record)
    assert record.memo == "내가 정리한 핵심 명령어만 남김"

    # FileInfo 응답 직렬화 확인
    info = FileInfo.model_validate(record)
    assert info.memo == "내가 정리한 핵심 명령어만 남김"
    assert FileMemoUpdate(memo="테스트").memo == "테스트"
