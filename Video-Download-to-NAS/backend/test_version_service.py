"""
Version Service 테스트
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone, timedelta
from app.services.version_service import VersionService


@pytest.fixture
def version_service():
    """Version Service 인스턴스"""
    return VersionService()


class TestVersionService:
    """Version Service 테스트"""
    
    def test_get_current_version_from_package_json(self, version_service, tmp_path):
        """package.json에서 버전 읽기 테스트"""
        # package.json 파일 생성
        package_json = tmp_path / "package.json"
        package_json.write_text('{"version": "1.2.3"}')
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', return_value=open(package_json)):
                version = version_service.get_current_version()
                assert version == "1.2.3"
    
    def test_get_current_version_fallback_to_env(self, version_service):
        """환경 변수 fallback 테스트"""
        with patch('os.path.exists', return_value=False):
            with patch('os.getenv', return_value='v2.0.0'):
                version = version_service.get_current_version()
                assert version == 'v2.0.0'
    
    def test_get_current_version_unknown(self, version_service):
        """버전을 찾을 수 없을 때 unknown 반환"""
        with patch('os.path.exists', return_value=False):
            with patch('os.getenv', return_value='unknown'):
                version = version_service.get_current_version()
                assert version == 'unknown'
    
    def test_get_current_digest_from_env(self, version_service):
        """환경 변수에서 digest 읽기"""
        with patch('os.getenv', return_value='sha256:abc123'):
            digest = version_service.get_current_digest()
            assert digest == 'sha256:abc123'
    
    def test_get_current_digest_unknown(self, version_service):
        """digest를 찾을 수 없을 때 unknown 반환"""
        with patch('os.getenv', return_value='unknown'):
            digest = version_service.get_current_digest()
            assert digest == 'unknown'
    
    @pytest.mark.asyncio
    async def test_get_dockerhub_digest_success(self, version_service):
        """Docker Hub API 성공 테스트"""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            'images': [{'digest': 'sha256:latest123'}]
        })
        
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response
            
            digest = await version_service.get_dockerhub_digest()
            assert digest == 'sha256:latest123'
    
    @pytest.mark.asyncio
    async def test_get_dockerhub_digest_failure(self, version_service):
        """Docker Hub API 실패 테스트"""
        mock_response = AsyncMock()
        mock_response.status = 404
        
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response
            
            digest = await version_service.get_dockerhub_digest()
            assert digest is None
    
    @pytest.mark.asyncio
    async def test_get_dockerhub_digest_timeout(self, version_service):
        """Docker Hub API 타임아웃 테스트"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.side_effect = asyncio.TimeoutError()
            
            digest = await version_service.get_dockerhub_digest()
            assert digest is None
    
    @pytest.mark.asyncio
    async def test_check_for_updates_update_available(self, version_service):
        """업데이트 가능 시나리오"""
        with patch.object(version_service, 'get_current_version', return_value='v1.0.0'):
            with patch.object(version_service, 'get_current_digest', return_value='sha256:old123'):
                with patch.object(version_service, 'get_dockerhub_digest', return_value=AsyncMock(return_value='sha256:new456')):
                    result = await version_service.check_for_updates()
                    
                    assert result['current_version'] == 'v1.0.0'
                    assert result['current_digest'] == 'sha256:old123'
                    assert result['latest_digest'] == 'sha256:new456'
                    assert result['update_available'] is True
    
    @pytest.mark.asyncio
    async def test_check_for_updates_no_update(self, version_service):
        """업데이트 없음 시나리오"""
        with patch.object(version_service, 'get_current_version', return_value='v1.0.0'):
            with patch.object(version_service, 'get_current_digest', return_value='sha256:same123'):
                with patch.object(version_service, 'get_dockerhub_digest', return_value=AsyncMock(return_value='sha256:same123')):
                    result = await version_service.check_for_updates()
                    
                    assert result['update_available'] is False
    
    @pytest.mark.asyncio
    async def test_check_for_updates_caching(self, version_service):
        """캐싱 동작 테스트"""
        # 첫 번째 호출
        with patch.object(version_service, 'get_current_version', return_value='v1.0.0'):
            with patch.object(version_service, 'get_current_digest', return_value='sha256:abc'):
                with patch.object(version_service, 'get_dockerhub_digest', return_value=AsyncMock(return_value='sha256:def')) as mock_dockerhub:
                    result1 = await version_service.check_for_updates()
                    assert mock_dockerhub.call_count == 1
                    
                    # 두 번째 호출 (캐시 사용)
                    result2 = await version_service.check_for_updates()
                    assert mock_dockerhub.call_count == 1  # 캐시 사용으로 호출 안 됨
                    
                    assert result1 == result2
    
    @pytest.mark.asyncio
    async def test_check_for_updates_cache_expiration(self, version_service):
        """캐시 만료 테스트"""
        # 첫 번째 호출
        with patch.object(version_service, 'get_current_version', return_value='v1.0.0'):
            with patch.object(version_service, 'get_current_digest', return_value='sha256:abc'):
                with patch.object(version_service, 'get_dockerhub_digest', return_value=AsyncMock(return_value='sha256:def')) as mock_dockerhub:
                    result1 = await version_service.check_for_updates()
                    
                    # 캐시 시간 조작 (1시간 이상 경과)
                    cache_key = "version_check"
                    cached_data, cached_time = version_service.cache[cache_key]
                    version_service.cache[cache_key] = (cached_data, cached_time - timedelta(hours=2))
                    
                    # 두 번째 호출 (캐시 만료로 새로 호출)
                    result2 = await version_service.check_for_updates()
                    assert mock_dockerhub.call_count == 2  # 캐시 만료로 다시 호출됨
