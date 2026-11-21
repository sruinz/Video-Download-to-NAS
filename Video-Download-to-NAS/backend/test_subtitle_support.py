from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
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
from app.database import Base, DownloadedFile, ShareToken, User
from app.migrations import migrate_subtitle_settings_schema
from app.models import SubtitleSettingsUpdate
from app.routers.users import get_subtitle_settings, update_subtitle_settings
from app.routers.share_links import get_share_link_subtitle
from app.subtitle_helper import (
    build_companion_subtitle_filename,
    find_matching_subtitles,
    is_subtitle_accessible_via_public_video,
    map_subtitles_for_videos,
    parse_subtitle_languages,
    srt_to_webvtt,
)


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
        username="subtester",
        hashed_password="not-used",
        folder_organization_mode="root",
        auto_download_subtitles=0,
        subtitle_languages="ko,en",
        subtitle_format="srt",
        subtitle_include_auto=1,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


def test_SRT_자막을_WebVTT로_정확하게_변환한다():
    srt_bytes = (
        "\ufeff1\r\n"
        "00:00:01,250 --> 00:00:03,500\r\n"
        "안녕하세요, 테스트 자막입니다.\r\n\r\n"
        "2\r\n"
        "00:00:04,000 --> 00:00:06,120\r\n"
        "두 번째 줄입니다.\r\n"
    ).encode("utf-8")

    vtt = srt_to_webvtt(srt_bytes)

    assert vtt.startswith("WEBVTT\n\n")
    assert "00:00:01.250 --> 00:00:03.500" in vtt
    assert "00:00:04.000 --> 00:00:06.120" in vtt
    assert "안녕하세요, 테스트 자막입니다." in vtt
    assert "\ufeff" not in vtt


def test_CP949_인코딩_SRT와_이미_VTT인_자막을_안전하게_처리한다():
    cp949_srt = (
        "1\n00:00:00,500 --> 00:00:02,000\n한글 CP949 자막\n"
    ).encode("cp949")
    converted = srt_to_webvtt(cp949_srt)
    assert converted.startswith("WEBVTT\n\n")
    assert "00:00:00.500 --> 00:00:02.000" in converted
    assert "한글 CP949 자막" in converted

    existing_vtt = b"WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nAlready VTT\n"
    vtt_out = srt_to_webvtt(existing_vtt)
    assert vtt_out.startswith("WEBVTT\n")
    assert vtt_out.count("WEBVTT") == 1


def test_동반_자막_파일명이_변경된_영상_stem과_언어_접미사를_보존한다():
    assert (
        build_companion_subtitle_filename("주머니쥐의 습성.ko.srt", "주머니쥐의 습성", "주머니쥐의 습성 (abcd1234)")
        == "주머니쥐의 습성 (abcd1234).ko.srt"
    )
    assert (
        build_companion_subtitle_filename("demo.zh-Hans.vtt", "demo", "custom_name")
        == "custom_name.zh-Hans.vtt"
    )
    assert (
        build_companion_subtitle_filename("demo.srt", "demo", "custom_name")
        == "custom_name.srt"
    )


def test_자막_설정_마이그레이션은_기존_DB에_안전하고_멱등하게_적용된다():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(50))")
        )
    session = sessionmaker(bind=engine)()
    try:
        first = migrate_subtitle_settings_schema(session)
        second = migrate_subtitle_settings_schema(session)

        assert first["success"] is True
        assert first["added_columns"] == 4
        assert second["success"] is True
        assert second["added_columns"] == 0
    finally:
        session.close()


def test_사용자_자막_설정_조회_및_업데이트_유효성_검증(test_db, test_user):
    initial = asyncio.run(get_subtitle_settings(current_user=test_user))
    assert initial.auto_download_subtitles is False
    assert initial.subtitle_languages == ["ko", "en"]
    assert initial.subtitle_format == "srt"
    assert initial.subtitle_include_auto is True

    updated = asyncio.run(
        update_subtitle_settings(
            SubtitleSettingsUpdate(
                auto_download_subtitles=True,
                subtitle_languages=["ko", "ja", "zh-Hans", "ko", "invalid lang!"],
                subtitle_format="vtt",
                subtitle_include_auto=False,
            ),
            current_user=test_user,
            db=test_db,
        )
    )
    assert updated.auto_download_subtitles is True
    assert updated.subtitle_languages == ["ko", "ja", "zh-Hans"]
    assert updated.subtitle_format == "vtt"
    assert updated.subtitle_include_auto is False

    # 자동 다운로드 활성화 상태에서 유효한 언어가 없으면 400 오류
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            update_subtitle_settings(
                SubtitleSettingsUpdate(
                    auto_download_subtitles=True,
                    subtitle_languages=["!!!"],
                    subtitle_format="srt",
                    subtitle_include_auto=True,
                ),
                current_user=test_user,
                db=test_db,
            )
        )
    assert exc_info.value.status_code == 400


def test_자막_자동_동시_다운로드_활성화시_영상과_동반_자막이_함께_등록된다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    test_user.auto_download_subtitles = 1
    test_user.subtitle_languages = "ko,en"
    test_user.subtitle_format = "srt"
    test_user.subtitle_include_auto = 1
    test_db.commit()

    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))
    captured_opts = {}

    def fake_download(ydl_opts, _url):
        captured_opts.update(ydl_opts)
        video_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "sample_video")
            .replace("%(ext)s", "mp4")
        )
        video_path.parent.mkdir(parents=True, exist_ok=True)
        video_path.write_bytes(b"video-binary-data")
        video_path.with_name("sample_video.ko.srt").write_text(
            "1\n00:00:01,000 --> 00:00:02,000\n안녕\n",
            encoding="utf-8",
        )
        video_path.with_name("sample_video.en.srt").write_text(
            "1\n00:00:01,000 --> 00:00:02,000\nHello\n",
            encoding="utf-8",
        )
        return {
            "filename": str(video_path),
            "filesize": 17,
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": 57,
            "title": "sample_video",
            "metadata": {"resolution": "1080p"},
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
            "https://media.example/watch?v=sub1",
            "best",
            "dl-with-subs",
            test_db,
            test_user.id,
        )
    )

    assert result["status"] == "success"
    assert captured_opts["writesubtitles"] is True
    assert captured_opts["writeautomaticsub"] is True
    assert captured_opts["subtitleslangs"] == ["ko", "en"]
    assert captured_opts["sleep_interval_subtitles"] == 2

    records = test_db.query(DownloadedFile).order_by(DownloadedFile.filename.asc()).all()
    assert len(records) == 3

    by_name = {r.filename: r for r in records}
    assert by_name["subtester/sample_video.mp4"].file_type == "video"
    assert by_name["subtester/sample_video.mp4"].duration == 57
    assert by_name["subtester/sample_video.ko.srt"].file_type == "subtitle"
    assert by_name["subtester/sample_video.ko.srt"].thumbnail is None
    assert by_name["subtester/sample_video.ko.srt"].duration is None
    assert by_name["subtester/sample_video.ko.srt"].file_size > 0
    assert by_name["subtester/sample_video.en.srt"].file_type == "subtitle"
    assert by_name["subtester/sample_video.en.srt"].file_size > 0


def test_자막_단독_다운로드시_실제_파일크기와_빈_썸네일_길이가_저장된다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    monkeypatch.setattr(downloader, "DOWNLOADS_DIR", str(tmp_path))

    def fake_download(ydl_opts, _url):
        video_path = Path(
            ydl_opts["outtmpl"]
            .replace("%(title)s", "only_sub")
            .replace("%(ext)s", "mp4")
        )
        sub_path = video_path.with_name("only_sub.ko.srt")
        sub_path.parent.mkdir(parents=True, exist_ok=True)
        sub_path.write_text("1\n00:00:01,000 --> 00:00:02,000\n자막\n", encoding="utf-8")
        return {
            "filename": str(video_path),
            "filesize": None,  # yt-dlp skip_download 시 None 반환 재현
            "thumbnail": "https://example.com/video-thumb.jpg",
            "duration": 120,
            "title": "only_sub",
            "metadata": {"resolution": "1080p"},
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
            "https://media.example/watch?v=onlysub",
            "srt|ko",
            "dl-only-sub",
            test_db,
            test_user.id,
        )
    )

    assert result["status"] == "success"
    record = test_db.query(DownloadedFile).one()
    assert record.file_type == "subtitle"
    assert record.file_size > 0
    assert record.thumbnail is None
    assert record.duration is None
    assert record.resolution is None


def test_동시_다운로드_중_일부_자막_429_실패해도_ignoreerrors를_격리하여_영상_다운로드를_계속한다(monkeypatch):
    observed = {}

    class FakeYoutubeDL:
        def __init__(self, params):
            self.params = dict(params)

        def _write_subtitles(self, _info_dict, _filename):
            observed["during_write_subtitles"] = self.params.get("ignoreerrors")
            if self.params.get("ignoreerrors") is not True:
                raise RuntimeError("HTTP Error 429: Too Many Requests")
            return [("video.ko.srt", "video.ko.srt")]

    monkeypatch.setattr(downloader.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    ydl = downloader._create_youtube_dl({
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["ko", "en"],
        "ignoreerrors": False,
    })

    result = ydl._write_subtitles({}, "video.mp4")

    assert result == [("video.ko.srt", "video.ko.srt")]
    assert observed["during_write_subtitles"] is True
    # 자막 단계 종료 후 원래의 ignoreerrors=False 로 복원되어야 실제 영상 오류는 정상 감지된다.
    assert ydl.params["ignoreerrors"] is False


def test_영상_다운로드_중_자막_완료_이벤트가_전체_완료로_오인되지_않는다():
    dl_id = "video-with-sub-progress"
    downloader.download_status[dl_id] = {
        "status": "downloading",
        "progress": 0.0,
        "filename": None,
        "error": None,
        "file_type": "video",
    }

    downloader.progress_hook(
        {"status": "finished", "filename": "/tmp/sample.ko.srt"},
        dl_id,
    )

    assert downloader.download_status[dl_id]["status"] == "downloading"
    assert downloader.download_status[dl_id]["progress"] == 0.0


def test_공개게시판_비공개_동반자막_자동매칭_및_접근권한_검증(test_db, test_user):
    pub_video = DownloadedFile(
        filename="subtester/demo.mp4",
        original_url="https://yt/demo",
        file_type="video",
        is_public=1,
        user_id=test_user.id,
    )
    priv_video = DownloadedFile(
        filename="subtester/secret.mp4",
        original_url="https://yt/secret",
        file_type="video",
        is_public=0,
        user_id=test_user.id,
    )
    pub_video_sub = DownloadedFile(
        filename="subtester/demo.ko.srt",
        original_url="https://yt/demo",
        file_type="subtitle",
        is_public=0,
        user_id=test_user.id,
    )
    priv_video_sub = DownloadedFile(
        filename="subtester/secret.ko.srt",
        original_url="https://yt/secret",
        file_type="subtitle",
        is_public=0,
        user_id=test_user.id,
    )
    test_db.add_all([pub_video, priv_video, pub_video_sub, priv_video_sub])
    test_db.commit()

    sub_map = map_subtitles_for_videos(test_db, [pub_video])
    assert len(sub_map[pub_video.id]) == 1
    assert sub_map[pub_video.id][0]["id"] == pub_video_sub.id
    assert sub_map[pub_video.id][0]["shortLabel"] == "KO"

    assert is_subtitle_accessible_via_public_video(test_db, pub_video_sub) is True
    assert is_subtitle_accessible_via_public_video(test_db, priv_video_sub) is False


def test_공유링크_동반자막_스트리밍은_비회원_허용링크에서_매칭자막만_반환한다(
    tmp_path,
    monkeypatch,
    test_db,
    test_user,
):
    video = DownloadedFile(
        filename="subtester/shared.mp4",
        original_url="https://yt/shared",
        file_type="video",
        user_id=test_user.id,
    )
    matched_sub = DownloadedFile(
        filename="subtester/shared.ko.srt",
        original_url="https://yt/shared",
        file_type="subtitle",
        user_id=test_user.id,
    )
    other_sub = DownloadedFile(
        filename="subtester/other.ko.srt",
        original_url="https://yt/other",
        file_type="subtitle",
        user_id=test_user.id,
    )
    test_db.add_all([video, matched_sub, other_sub])
    test_db.commit()

    sub_disk_path = tmp_path / "subtester" / "shared.ko.srt"
    sub_disk_path.parent.mkdir(parents=True, exist_ok=True)
    sub_disk_path.write_text(
        "1\n00:00:01,000 --> 00:00:03,000\n공유 자막 테스트\n",
        encoding="utf-8",
    )

    share_link = ShareToken(
        token="tok-anon-sub",
        file_id=video.id,
        user_id=test_user.id,
        allow_anonymous=1,
        is_active=1,
        view_count=1,
        max_views=1,
    )
    test_db.add(share_link)
    test_db.commit()

    assert len(find_matching_subtitles(test_db, video)) == 1

    # Path("/app/downloads")를 tmp_path로 패치하여 WebVTT 응답 검증
    original_path = Path

    def patched_path(p):
        if str(p) == "/app/downloads":
            return tmp_path
        return original_path(p)

    import pathlib
    monkeypatch.setattr(pathlib, "Path", patched_path)

    resp = asyncio.run(
        get_share_link_subtitle(
            token="tok-anon-sub",
            subtitle_id=matched_sub.id,
            password=None,
            db=test_db,
            authorization=None,
        )
    )
    assert resp.media_type == "text/vtt; charset=utf-8"
    assert b"WEBVTT" in resp.body
    assert "공유 자막 테스트".encode("utf-8") in resp.body

    # 다른 영상의 자막 ID 요청은 403 차단
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            get_share_link_subtitle(
                token="tok-anon-sub",
                subtitle_id=other_sub.id,
                password=None,
                db=test_db,
                authorization=None,
            )
        )
    assert exc_info.value.status_code == 403


