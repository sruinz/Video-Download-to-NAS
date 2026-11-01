from pathlib import Path
import asyncio
import sys
import threading
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    import yt_dlp  # noqa: F401
except ModuleNotFoundError:
    sys.modules["yt_dlp"] = SimpleNamespace(YoutubeDL=None)

with patch("os.makedirs"):
    from app import downloader
from app.database import Base, DownloadedFile, User


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


def test_같은_추출기_제목의_파일도_요청한_이름으로_각각_저장한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))
    call_lock = threading.Lock()
    second_started = threading.Event()
    first_finished = threading.Event()
    call_count = 0
    overlap_detected = False

    def fake_download(ydl_opts, url):
        nonlocal call_count, overlap_detected
        with call_lock:
            call_count += 1
            call_number = call_count

        if call_number == 1:
            second_started.wait(timeout=0.25)
        else:
            if not first_finished.is_set():
                overlap_detected = True
            second_started.set()

        output_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "procFileOutput")
            .replace("%(ext)s", "mp4")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        content = b"first-video" if url.endswith("first") else b"second-video"
        output_path.write_bytes(content)
        try:
            return {
                "filename": str(output_path),
                "filesize": len(content),
                "thumbnail": "https://media.example/thumbnail.jpg",
                "duration": 1,
                "title": "procFileOutput",
                "metadata": {},
            }
        finally:
            if call_number == 1:
                first_finished.set()

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    async def run_downloads():
        return await asyncio.gather(
            downloader.download_video(
                "https://media.example/first",
                "best",
                "download-first",
                test_db,
                test_user.id,
                requested_filename="first.mp4",
            ),
            downloader.download_video(
                "https://media.example/second",
                "best",
                "download-second",
                test_db,
                test_user.id,
                requested_filename="second.mp4",
            ),
        )

    first, second = asyncio.run(run_downloads())

    records = test_db.query(DownloadedFile).all()
    assert first["status"] == "success"
    assert second["status"] == "success"
    assert overlap_detected is False
    assert sorted(record.filename for record in records) == [
        "tester/first.mp4",
        "tester/second.mp4",
    ]
    assert (tmp_path / "tester" / "first.mp4").read_bytes() == b"first-video"
    assert (tmp_path / "tester" / "second.mp4").read_bytes() == b"second-video"


def test_원본_서버가_429를_반환하면_대기한_뒤_자동으로_재시도한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))
    monkeypatch.setattr(
        downloader,
        "RATE_LIMIT_RETRY_DELAYS",
        (0, 0),
        raising=False,
    )
    attempts = 0

    def fake_download(ydl_opts, _url):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise RuntimeError("HTTP Error 429: Too Many Requests")

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
            "duration": 1,
            "title": "video",
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/video",
            "best",
            "download-retry",
            test_db,
            test_user.id,
            requested_filename="video.mp4",
        )
    )

    assert result["status"] == "success"
    assert attempts == 3
    assert (tmp_path / "tester" / "video.mp4").read_bytes() == b"video-content"


def test_플레이리스트의_모든_결과_파일을_임시_폴더_밖으로_보존한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        first_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "episode-one")
            .replace("%(ext)s", "mp4")
        )
        second_path = first_path.with_name("episode-two.mp4")
        first_path.parent.mkdir(parents=True, exist_ok=True)
        first_path.write_bytes(b"episode-one")
        second_path.write_bytes(b"episode-two")
        return {
            "filename": str(first_path),
            "filesize": len(b"episode-one"),
            "thumbnail": None,
            "duration": 1,
            "title": "playlist",
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/playlist",
            "best",
            "download-playlist",
            test_db,
            test_user.id,
            requested_filename="playlist.mp4",
        )
    )

    assert result["status"] == "success"
    assert (tmp_path / "tester" / "episode-one.mp4").read_bytes() == b"episode-one"
    assert (tmp_path / "tester" / "episode-two.mp4").read_bytes() == b"episode-two"
    assert not (tmp_path / "tester" / ".vdtn-tmp").exists()


def test_플레이리스트의_혼합_확장자_결과도_모두_보존한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        first_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "episode-one")
            .replace("%(ext)s", "mp4")
        )
        second_path = first_path.with_name("episode-two.webm")
        first_path.parent.mkdir(parents=True, exist_ok=True)
        first_path.write_bytes(b"episode-one")
        second_path.write_bytes(b"episode-two")
        return {
            "filename": str(first_path),
            "filesize": len(b"episode-one"),
            "thumbnail": None,
            "duration": 1,
            "title": "playlist",
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/mixed-playlist",
            "best",
            "download-mixed-playlist",
            test_db,
            test_user.id,
            requested_filename="playlist.mp4",
        )
    )

    assert result["status"] == "success"
    assert (tmp_path / "tester" / "episode-one.mp4").read_bytes() == b"episode-one"
    assert (tmp_path / "tester" / "episode-two.webm").read_bytes() == b"episode-two"
    record = test_db.query(DownloadedFile).one()
    assert record.filename == "tester/episode-one.mp4"


def test_자막_전용_다운로드는_실제로_생성된_자막_파일을_보존한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        video_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "video")
            .replace("%(ext)s", "mp4")
        )
        subtitle_path = video_path.with_name("video.ko.srt")
        subtitle_path.parent.mkdir(parents=True, exist_ok=True)
        subtitle_path.write_text("subtitle-content", encoding="utf-8")
        return {
            "filename": str(video_path),
            "filesize": subtitle_path.stat().st_size,
            "thumbnail": None,
            "duration": 1,
            "title": "video",
            "metadata": {},
        }

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/subtitle",
            "srt|ko",
            "download-subtitle",
            test_db,
            test_user.id,
            requested_filename="captions.srt",
        )
    )

    assert result["status"] == "success"
    assert (tmp_path / "tester" / "captions.srt").read_text(
        encoding="utf-8"
    ) == "subtitle-content"


def test_다중_결과_이동이_중단되면_남은_완료_파일을_삭제하지_않는다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        first_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "episode-one")
            .replace("%(ext)s", "mp4")
        )
        second_path = first_path.with_name("episode-two.mp4")
        first_path.parent.mkdir(parents=True, exist_ok=True)
        first_path.write_bytes(b"episode-one")
        second_path.write_bytes(b"episode-two")
        return {
            "filename": str(first_path),
            "filesize": len(b"episode-one"),
            "thumbnail": None,
            "duration": 1,
            "title": "playlist",
            "metadata": {},
        }

    original_move = downloader._move_download_to_output

    def fail_on_second(source_path, output_dir, requested_filename, download_id):
        if Path(source_path).name == "episode-two.mp4":
            raise OSError("simulated move failure")
        return original_move(
            source_path,
            output_dir,
            requested_filename,
            download_id,
        )

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    monkeypatch.setattr(downloader, "_move_download_to_output", fail_on_second)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/playlist-failure",
            "best",
            "download-move-failure",
            test_db,
            test_user.id,
            requested_filename="playlist.mp4",
        )
    )

    remaining_path = (
        tmp_path
        / "tester"
        / ".vdtn-tmp"
        / "download-move-failure"
        / "episode-two.mp4"
    )
    assert result["status"] == "error"
    assert remaining_path.read_bytes() == b"episode-two"


def test_플레이리스트_후속_항목이_실패해도_완료된_파일을_보존한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        completed_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "episode-one")
            .replace("%(ext)s", "mp4")
        )
        completed_path.parent.mkdir(parents=True, exist_ok=True)
        completed_path.write_bytes(b"episode-one")
        raise RuntimeError("later playlist item failed")

    async def ignore_notification(**_kwargs):
        return None

    monkeypatch.setattr(downloader, "_download_with_ydl", fake_download)
    notification_manager = SimpleNamespace(
        send_download_complete_notification=ignore_notification,
        send_download_failed_notification=ignore_notification,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=notification_manager),
    )

    result = asyncio.run(
        downloader.download_video(
            "https://media.example/partial-playlist",
            "best",
            "download-partial-failure",
            test_db,
            test_user.id,
        )
    )

    completed_path = (
        tmp_path
        / "tester"
        / ".vdtn-tmp"
        / "download-partial-failure"
        / "episode-one.mp4"
    )
    assert result["status"] == "error"
    assert completed_path.read_bytes() == b"episode-one"


def test_실행_취소_중에도_작성된_파일과_임시_폴더를_보존한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    async def cancel_download(_loop, ydl_opts, _url, _download_id, _logger):
        completed_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "episode-one")
            .replace("%(ext)s", "mp4")
        )
        completed_path.parent.mkdir(parents=True, exist_ok=True)
        completed_path.write_bytes(b"episode-one")
        raise asyncio.CancelledError

    monkeypatch.setattr(
        downloader,
        "_download_with_rate_limit_retry",
        cancel_download,
    )
    monkeypatch.setitem(
        sys.modules,
        "app.telegram.notifications",
        SimpleNamespace(notification_manager=SimpleNamespace()),
    )

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            downloader.download_video(
                "https://media.example/cancelled-playlist",
                "best",
                "download-cancelled",
                test_db,
                test_user.id,
            )
        )

    completed_path = (
        tmp_path
        / "tester"
        / ".vdtn-tmp"
        / "download-cancelled"
        / "episode-one.mp4"
    )
    assert completed_path.read_bytes() == b"episode-one"


def test_URL이나_비디오ID_형태의_요청파일명은_무시하고_실제_추출제목을_사용한다():
    fallback = "실제 영상 제목.mp4"
    ext = ".mp4"

    # 1. 전체 URL 형태
    assert downloader._safe_output_filename(
        "https://www.youtube.com/watch?v=UEChtiIMue4",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"

    # 2. watch?v= 또는 watch_v= 형태
    assert downloader._safe_output_filename(
        "watch?v=UEChtiIMue4",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"
    assert downloader._safe_output_filename(
        "watch_v=UEChtiIMue4.mp4",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"

    # 3. 11자리 비디오 ID 형태 (쇼츠 ID 등)
    assert downloader._safe_output_filename(
        "yfCy27N-bVQ",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"
    assert downloader._safe_output_filename(
        "qmJN1h3BQQk",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"

    # 4. 일반 스트림 식별자
    assert downloader._safe_output_filename(
        "videoplayback",
        fallback,
        ext,
    ) == "실제 영상 제목.mp4"

    # 5. 정상적으로 사용자가 지정한 파일명은 유지
    assert downloader._safe_output_filename(
        "사용자_지정_파일명.mp4",
        fallback,
        ext,
    ) == "사용자_지정_파일명.mp4"

