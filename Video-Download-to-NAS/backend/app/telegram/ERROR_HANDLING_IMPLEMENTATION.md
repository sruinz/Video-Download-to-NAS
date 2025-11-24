# 텔레그램 봇 에러 처리 및 자동 재시작 구현

## 개요

Task 4.8 "에러 처리 및 자동 재시작" 구현 완료. 텔레그램 봇의 크래시를 감지하고 지수 백오프 전략으로 자동 재시작하는 기능을 추가했습니다.

## 구현된 기능

### 1. 봇 모니터링 시스템

#### `_monitor_bot(user_id: int)` 메서드
- **목적**: 봇의 상태를 지속적으로 모니터링하여 크래시 감지
- **동작 방식**:
  - 30초마다 봇의 `application.running` 상태 확인
  - 봇이 예기치 않게 중지되면 `_handle_bot_crash()` 호출
  - `asyncio.CancelledError` 처리로 정상 종료 지원
- **실행 시점**: 봇 시작 시 자동으로 백그라운드 태스크로 실행

```python
async def _monitor_bot(self, user_id: int):
    """봇 상태 모니터링 및 크래시 감지"""
    try:
        while user_id in self.active_bots:
            await asyncio.sleep(30)  # 30초마다 체크
            
            if user_id not in self.active_bots:
                break
            
            application = self.active_bots[user_id]
            
            if not application.running:
                logger.warning(f"Bot for user {user_id} stopped unexpectedly")
                await self._handle_bot_crash(user_id)
                break
    except asyncio.CancelledError:
        logger.info(f"Monitor task cancelled for user {user_id}")
    except Exception as e:
        logger.error(f"Monitor task error for user {user_id}: {e}")
        await self._handle_bot_crash(user_id)
```

### 2. 자동 재시작 시스템

#### `_handle_bot_crash(user_id: int)` 메서드
- **목적**: 봇 크래시 시 자동으로 재시작 시도
- **재시작 제한**: 최대 5회까지 재시도
- **지수 백오프 전략**:
  - 1차 시도: 5초 대기
  - 2차 시도: 10초 대기
  - 3차 시도: 30초 대기
  - 4차 시도: 1분 대기
  - 5차 시도: 5분 대기

```python
# 지수 백오프 계산
backoff_delays = [5, 10, 30, 60, 300]
delay = backoff_delays[min(restart_count, len(backoff_delays) - 1)]
```

#### 재시작 프로세스
1. **재시작 횟수 확인**: `restart_counts` 딕셔너리에서 현재 횟수 조회
2. **최대 횟수 초과 시**:
   - DB 상태를 'error'로 업데이트
   - 에러 메시지: "봇이 5회 재시작 시도 후 실패했습니다. 수동으로 재시작해주세요."
   - 봇 정리 및 종료
3. **재시작 가능 시**:
   - 재시작 카운트 증가
   - DB 상태를 'restarting'으로 업데이트
   - 기존 봇 정리 (Application 종료)
   - 백오프 시간만큼 대기
   - 새로운 봇 인스턴스 시작
   - 실패 시 재귀적으로 다음 재시도

### 3. 재시작 카운트 관리

#### `restart_counts: Dict[int, int]`
- **목적**: 각 사용자 봇의 재시작 횟수 추적
- **초기화 시점**:
  - 수동으로 봇 시작 시 (`is_auto_restart=False`)
  - 봇 중지 시
- **증가 시점**: 자동 재시작 시도 시

```python
# TelegramBotManager.__init__
self.restart_counts: Dict[int, int] = {}  # user_id -> restart count

# start_bot에서 초기화
if not is_auto_restart:
    self.restart_counts[user_id] = 0

# stop_bot에서 정리
if user_id in self.restart_counts:
    del self.restart_counts[user_id]
```

### 4. DB 상태 업데이트

#### 상태 전이
- **running**: 봇이 정상 실행 중
- **restarting**: 자동 재시작 진행 중
- **error**: 최대 재시작 횟수 초과 또는 치명적 에러
- **stopped**: 사용자가 수동으로 중지

#### 에러 메시지 저장
- 재시작 시도 중: "봇 재시작 중... (시도 X/5)"
- 최대 횟수 초과: "봇이 5회 재시작 시도 후 실패했습니다. 수동으로 재시작해주세요."
- 일반 에러: 예외 메시지 그대로 저장

### 5. 로깅

모든 주요 이벤트에 대한 상세 로깅:
- 봇 크래시 감지
- 재시작 시도 (횟수, 대기 시간 포함)
- 재시작 성공/실패
- 최대 재시도 횟수 초과
- 모니터링 태스크 취소

## 사용 예시

### 정상 시나리오
```python
# 1. 봇 시작
await bot_manager.start_bot(user_id, bot_config)
# -> restart_counts[user_id] = 0
# -> 모니터링 태스크 시작

# 2. 봇이 30초마다 체크됨
# -> application.running == True

# 3. 사용자가 봇 중지
await bot_manager.stop_bot(user_id)
# -> 모니터링 태스크 취소
# -> restart_counts[user_id] 삭제
```

### 크래시 및 자동 재시작 시나리오
```python
# 1. 봇 실행 중 크래시 발생
# -> _monitor_bot이 감지: application.running == False

# 2. 첫 번째 재시작 시도
# -> 5초 대기
# -> restart_counts[user_id] = 1
# -> DB: status='restarting', error_message='봇 재시작 중... (시도 1/5)'
# -> 봇 재시작 성공

# 3. 다시 크래시 발생 (반복)
# -> 10초 대기 (2차)
# -> 30초 대기 (3차)
# -> 1분 대기 (4차)
# -> 5분 대기 (5차)

# 4. 5회 실패 후
# -> DB: status='error'
# -> error_message='봇이 5회 재시작 시도 후 실패했습니다...'
# -> 봇 정리 및 종료
```

## 요구사항 충족

### Requirement 11.2
- ✅ 봇 크래시 감지: `_monitor_bot()` 메서드
- ✅ 지수 백오프로 재시작: [5, 10, 30, 60, 300]초
- ✅ 최대 5회 재시도
- ✅ 에러 메시지 DB 저장

## 테스트 방법

### 수동 테스트
1. 봇 시작 후 텔레그램 API 토큰 무효화
2. 봇이 자동으로 재시작 시도하는지 확인
3. 로그에서 재시작 횟수와 대기 시간 확인
4. 5회 실패 후 'error' 상태로 전환되는지 확인

### 로그 확인
```bash
# Docker 환경에서
docker-compose logs -f backend | grep "Restarting bot"
docker-compose logs -f backend | grep "exceeded max restart"
```

## 향후 개선 사항

1. **알림 기능**: 최대 재시도 횟수 초과 시 관리자에게 알림
2. **재시작 통계**: 재시작 횟수, 성공률 등 통계 수집
3. **동적 백오프**: 에러 유형에 따라 백오프 전략 조정
4. **헬스 체크**: 주기적인 봇 상태 확인 (getMe API 호출)
5. **재시작 정책 설정**: 사용자별로 재시작 정책 커스터마이징

## 관련 파일

- `server/backend/app/telegram/bot_manager.py`: 메인 구현
- `server/backend/app/database.py`: TelegramBot 모델 (status, error_message 필드)
- `.kiro/specs/integrated-telegram-bot/tasks.md`: Task 4.8

## 구현 완료 날짜

2024년 (구현 완료)
