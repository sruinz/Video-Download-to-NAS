import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pydantic import TypeAdapter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    import yt_dlp  # noqa: F401
except ModuleNotFoundError:
    sys.modules["yt_dlp"] = SimpleNamespace(YoutubeDL=None)

with patch("os.makedirs"):
    from app import downloader
from app.database import Base, DownloadedFile, User
from app.migrations import migrate_downloaded_file_duration_values
from app.models import FileInfo


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
        username="tester",
        hashed_password="not-used",
        folder_organization_mode="root",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


def test_소수_길이_다운로드도_라이브러리_응답에_사용할_정수로_저장한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        output_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "video")
            .replace("%(ext)s", "mp4")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"video-content")
        return {
            "filename": str(output_path),
            "filesize": len(b"video-content"),
            "thumbnail": None,
            "duration": 78.633,
            "title": "video",
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
            "https://media.example/fractional-duration",
            "best",
            "download-fractional-duration",
            test_db,
            test_user.id,
            requested_filename="video.mp4",
        )
    )

    record = test_db.query(DownloadedFile).one()
    assert result["status"] == "success"
    assert record.duration == 78
    assert TypeAdapter(list[FileInfo]).validate_python(
        [record], from_attributes=True
    )[0].duration == 78


def test_기존_소수_길이_레코드를_정수_초로_보정한다(test_db, test_user):
    test_db.add_all([
        DownloadedFile(
            filename="tester/fractional.mp4",
            original_url="https://media.example/fractional",
            file_type="video",
            duration=78.633,
            user_id=test_user.id,
        ),
        DownloadedFile(
            filename="tester/integer.mp4",
            original_url="https://media.example/integer",
            file_type="video",
            duration=60,
            user_id=test_user.id,
        ),
    ])
    test_db.commit()

    result = migrate_downloaded_file_duration_values(test_db)
    records = test_db.query(DownloadedFile).order_by(DownloadedFile.id).all()

    assert result["normalized_count"] == 1
    assert [record.duration for record in records] == [78, 60]
    assert len(TypeAdapter(list[FileInfo]).validate_python(
        records, from_attributes=True
    )) == 2
