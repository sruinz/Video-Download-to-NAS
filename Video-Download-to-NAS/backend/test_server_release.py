from pathlib import Path

from app.services.version_service import VersionService


def test_실행_중인_백엔드가_버전_1_1_8_2을_보고한다():
    assert VersionService().get_current_version() == "1.1.8-2"


def test_도커_빌드에_포함되는_버전_파일이_1_1_8_2이다():
    version_file = Path(__file__).parent.parent / "VERSION"

    assert version_file.read_text(encoding="utf-8").strip() == "1.1.8-2"
