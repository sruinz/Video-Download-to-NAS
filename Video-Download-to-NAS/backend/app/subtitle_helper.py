"""자막 설정 정규화, SRT→WebVTT 변환 및 동반 자막 파일명 매칭 유틸리티"""
from pathlib import Path
import re
from typing import Iterable, List, Optional, Union

SUPPORTED_SUBTITLE_LANGUAGES = ("ko", "en", "ja", "zh-Hans", "zh-Hant")
SUPPORTED_SUBTITLE_FORMATS = frozenset({"srt", "vtt"})
DEFAULT_SUBTITLE_LANGUAGES = ("ko", "en")
DEFAULT_SUBTITLE_FORMAT = "srt"

_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$")
_SRT_TIMESTAMP_RE = re.compile(
    r"(\d{1,2}:\d{2}:\d{2}),(\d{3})(\s*-->\s*)(\d{1,2}:\d{2}:\d{2}),(\d{3})"
)


def parse_subtitle_languages(
    raw: Optional[Union[str, Iterable[str]]],
) -> List[str]:
    """자막 언어 문자열 또는 리스트를 검증·중복 제거하여 리스트로 반환한다."""
    if raw is None:
        return []

    if isinstance(raw, str):
        candidates = raw.split(",")
    else:
        candidates = list(raw)

    result: List[str] = []
    seen = set()
    for item in candidates:
        tag = str(item).strip()
        if not tag:
            continue
        if not _LANG_TAG_RE.match(tag):
            continue
        lowered = tag.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(tag)
        if len(result) >= 10:
            break
    return result


def serialize_subtitle_languages(languages: Iterable[str]) -> str:
    """언어 코드 리스트를 DB 저장용 쉼표 구분 문자열로 직렬화한다."""
    return ",".join(parse_subtitle_languages(languages))


def normalize_subtitle_format(fmt: Optional[str]) -> str:
    """자막 저장 형식을 검증하고 기본값(srt)을 적용한다."""
    if not fmt:
        return DEFAULT_SUBTITLE_FORMAT
    lowered = str(fmt).strip().lower()
    if lowered in SUPPORTED_SUBTITLE_FORMATS:
        return lowered
    return DEFAULT_SUBTITLE_FORMAT


def decode_subtitle_bytes(raw_bytes: bytes) -> str:
    """자막 바이트를 UTF-8-SIG / UTF-8 / CP949 / EUC-KR 순으로 안전하게 디코딩한다."""
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode("latin-1", errors="replace")


def srt_to_webvtt(raw_bytes: bytes) -> str:
    """SRT 또는 VTT 자막 바이트를 브라우저 <track> 호환 WebVTT 문자열로 변환한다."""
    text = decode_subtitle_bytes(raw_bytes)
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    stripped = text.lstrip()
    if stripped.startswith("WEBVTT"):
        return stripped

    converted = _SRT_TIMESTAMP_RE.sub(r"\1.\2\3\4.\5", text)
    return f"WEBVTT\n\n{converted.lstrip()}"


def extract_subtitle_language_suffix(
    source_name: str,
    video_source_stem: Optional[str] = None,
) -> str:
    """자막 파일명에서 언어 접미사(예: '.ko', '.zh-Hans')를 추출한다."""
    stem = Path(source_name).stem

    if video_source_stem and stem.startswith(f"{video_source_stem}."):
        remainder = stem[len(video_source_stem) + 1 :]
        if remainder and _LANG_TAG_RE.match(remainder):
            return f".{remainder}"

    if "." in stem:
        tail = stem.rsplit(".", 1)[-1]
        if _LANG_TAG_RE.match(tail):
            return f".{tail}"

    return ""


def build_companion_subtitle_filename(
    source_name: str,
    video_source_stem: str,
    video_dest_stem: str,
) -> str:
    """영상의 최종 저장 파일명 stem에 맞춰 동반 자막 파일명을 생성한다."""
    ext = Path(source_name).suffix.lower() or ".srt"
    lang_suffix = extract_subtitle_language_suffix(source_name, video_source_stem)
    return f"{video_dest_stem}{lang_suffix}{ext}"


_KNOWN_3_LETTER_LANGS = frozenset({"kor", "eng", "jpn", "zho", "chi", "spa", "fra", "deu", "und"})
_SHORT_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?(?:-[a-zA-Z0-9]{2,6})?$")


def get_subtitle_short_label(lang: Optional[str]) -> str:
    """언어 코드를 UI 뱃지용 짧은 라벨(KO, EN, ZH 등)로 정규화한다."""
    if not lang:
        return "CC"
    normalized = str(lang).strip()
    lowered = normalized.lower()
    if lowered in ("zh-hans", "zh-cn", "zh-sg"):
        return "ZH"
    if lowered in ("zh-hant", "zh-tw", "zh-hk"):
        return "ZH-TW"
    if lowered.startswith("ko"):
        return "KO"
    if lowered.startswith("en"):
        return "EN"
    if lowered.startswith("ja"):
        return "JA"
    return normalized.upper()


def parse_subtitle_path_info(filename: str) -> dict:
    """자막 상대 경로에서 폴더, 기본 stem, 언어 코드, 포맷을 추출한다."""
    normalized = str(filename or "").replace("\\", "/")
    if "/" in normalized:
        dir_part, basename = normalized.rsplit("/", 1)
    else:
        dir_part, basename = "", normalized

    if "." in basename:
        stem_without_ext, ext_part = basename.rsplit(".", 1)
        fmt = ext_part.upper()
    else:
        stem_without_ext, fmt = basename, "SUB"

    base_stem = stem_without_ext
    lang = ""
    if "." in stem_without_ext:
        candidate_stem, candidate_lang = stem_without_ext.rsplit(".", 1)
        if _SHORT_LANG_TAG_RE.match(candidate_lang) or candidate_lang.lower() in _KNOWN_3_LETTER_LANGS:
            base_stem = candidate_stem
            lang = candidate_lang

    return {
        "dir": dir_part,
        "base_stem": base_stem,
        "lang": lang,
        "shortLabel": get_subtitle_short_label(lang),
        "format": fmt,
    }


def extract_media_dir_and_stem(filename: str) -> tuple[str, str]:
    """미디어 파일 상대 경로에서 폴더와 확장자를 제외한 stem을 추출한다."""
    normalized = str(filename or "").replace("\\", "/")
    if "/" in normalized:
        dir_part, basename = normalized.rsplit("/", 1)
    else:
        dir_part, basename = "", normalized

    stem = basename.rsplit(".", 1)[0] if "." in basename else basename
    return dir_part, stem


def subtitle_matches_media(
    sub_filename: str,
    sub_url: Optional[str],
    media_filename: str,
    media_url: Optional[str],
) -> bool:
    """자막 파일이 특정 영상 파일과 매칭되는지 판별한다 (폴더+stem 또는 원본 URL)."""
    sub_info = parse_subtitle_path_info(sub_filename)
    media_dir, media_stem = extract_media_dir_and_stem(media_filename)

    if (
        sub_info["dir"].lower() == media_dir.lower()
        and sub_info["base_stem"].lower() == media_stem.lower()
    ):
        return True

    norm_sub_url = (sub_url or "").strip()
    norm_media_url = (media_url or "").strip()
    if norm_sub_url and norm_media_url and norm_sub_url == norm_media_url:
        return True

    return False


def build_subtitle_descriptor(sub_file) -> dict:
    """DownloadedFile 자막 레코드를 프론트엔드 플레이어용 자막 트랙 딕셔너리로 변환한다."""
    info = parse_subtitle_path_info(sub_file.filename)
    return {
        "id": sub_file.id,
        "filename": sub_file.filename,
        "lang": info["lang"],
        "shortLabel": info["shortLabel"],
        "format": info["format"],
        "isPublic": bool(getattr(sub_file, "is_public", 0)),
    }


def find_matching_subtitles(db, media_file) -> List[dict]:
    """영상 파일 소유자의 라이브러리에서 매칭되는 동반 자막 트랙 목록을 조회한다."""
    from .database import DownloadedFile

    if not media_file or getattr(media_file, "file_type", None) != "video":
        return []

    sub_candidates = (
        db.query(DownloadedFile)
        .filter(
            DownloadedFile.user_id == media_file.user_id,
            DownloadedFile.file_type == "subtitle",
        )
        .all()
    )

    matched = [
        build_subtitle_descriptor(sub)
        for sub in sub_candidates
        if subtitle_matches_media(
            sub.filename,
            sub.original_url,
            media_file.filename,
            media_file.original_url,
        )
    ]
    matched.sort(key=lambda item: (item["shortLabel"], item["filename"]))
    return matched


def map_subtitles_for_videos(db, media_files) -> dict[int, List[dict]]:
    """여러 영상 목록에 대해 사용자별 단일 쿼리로 매칭 자막 딕셔너리를 일괄 구성한다."""
    from .database import DownloadedFile

    video_files = [f for f in media_files if f and getattr(f, "file_type", None) == "video"]
    if not video_files:
        return {}

    user_ids = {f.user_id for f in video_files}
    sub_rows = (
        db.query(DownloadedFile)
        .filter(
            DownloadedFile.user_id.in_(user_ids),
            DownloadedFile.file_type == "subtitle",
        )
        .all()
    )

    subs_by_user: dict[int, list] = {}
    for sub in sub_rows:
        subs_by_user.setdefault(sub.user_id, []).append(sub)

    result: dict[int, List[dict]] = {}
    for video in video_files:
        candidates = subs_by_user.get(video.user_id, [])
        matched = [
            build_subtitle_descriptor(sub)
            for sub in candidates
            if subtitle_matches_media(
                sub.filename,
                sub.original_url,
                video.filename,
                video.original_url,
            )
        ]
        matched.sort(key=lambda item: (item["shortLabel"], item["filename"]))
        result[video.id] = matched

    return result


def is_subtitle_accessible_via_public_video(db, subtitle_file) -> bool:
    """자막 파일 자체가 공개이거나, 매칭되는 같은 소유자의 영상이 공개 상태인지 확인한다."""
    from .database import DownloadedFile

    if not subtitle_file:
        return False
    if getattr(subtitle_file, "is_public", 0) == 1:
        return True

    public_videos = (
        db.query(DownloadedFile)
        .filter(
            DownloadedFile.user_id == subtitle_file.user_id,
            DownloadedFile.file_type == "video",
            DownloadedFile.is_public == 1,
        )
        .all()
    )
    return any(
        subtitle_matches_media(
            subtitle_file.filename,
            subtitle_file.original_url,
            video.filename,
            video.original_url,
        )
        for video in public_videos
    )
