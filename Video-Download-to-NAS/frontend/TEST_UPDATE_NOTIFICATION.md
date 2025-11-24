# Update Notification 테스트 가이드

## 개요

업데이트 알림 시스템의 Frontend 테스트 가이드입니다.

## 수동 테스트

### 1. UpdateBanner 컴포넌트 테스트

#### 테스트 시나리오
1. **배너 표시 테스트**
   - 관리자 계정으로 로그인
   - 업데이트가 있을 때 상단에 배너 표시 확인
   - 배너 애니메이션 (slideDown) 확인

2. **배너 닫기 테스트**
   - X 버튼 클릭
   - 배너가 사라지는지 확인
   - localStorage에 digest 저장 확인 (`vdtn_dismissed_update_digest`)
   - 페이지 새로고침 후 배너가 다시 나타나지 않는지 확인

3. **업데이트 가이드 링크 테스트**
   - "업데이트 가이드" 버튼 클릭
   - 새 탭에서 서버포럼 가이드 페이지 열리는지 확인
   - URL: https://svrforum.com/article_series/dispArticle_seriesView?series_id=8

4. **반응형 디자인 테스트**
   - 모바일 화면에서 배너 레이아웃 확인
   - 버튼들이 적절히 배치되는지 확인

### 2. useVersionCheck Hook 테스트

#### 테스트 시나리오
1. **관리자 권한 체크**
   - 관리자 계정: 버전 체크 실행
   - 일반 사용자 계정: 버전 체크 실행 안 됨
   - 게스트 계정: 버전 체크 실행 안 됨

2. **초기 로드 체크**
   - 페이지 로드 시 자동으로 버전 체크 실행
   - 네트워크 탭에서 `/api/version/check` 호출 확인

3. **주기적 체크**
   - 24시간마다 자동 체크 (실제 테스트는 어려움)
   - 개발 시 CHECK_INTERVAL을 짧게 설정하여 테스트

4. **localStorage 저장**
   - 배너 닫기 후 localStorage 확인
   - 키: `vdtn_dismissed_update_digest`
   - 값: latest digest

5. **에러 처리**
   - 네트워크 오류 시 조용히 실패
   - 콘솔에 에러 로그만 출력

### 3. Footer 컴포넌트 테스트

#### 테스트 시나리오
1. **버전 정보 표시**
   - Footer에 현재 버전 표시 확인
   - 형식: "버전: v1.0.0"

2. **업데이트 배지 표시**
   - 업데이트가 있을 때 green badge 표시
   - 텍스트: "업데이트 가능"

3. **가이드 링크**
   - "가이드" 링크 클릭
   - 새 탭에서 서버포럼 페이지 열리는지 확인

4. **반응형 디자인**
   - 모바일에서 Footer 레이아웃 확인

## 자동 테스트 (향후 구현)

### React Testing Library 테스트

```javascript
// UpdateBanner.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import UpdateBanner from './UpdateBanner';
import i18n from '../i18n';

describe('UpdateBanner', () => {
  const mockOnDismiss = jest.fn();
  
  const defaultProps = {
    currentVersion: 'v1.0.0',
    latestDigest: 'sha256:abc123',
    onDismiss: mockOnDismiss
  };
  
  it('renders banner with version info', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UpdateBanner {...defaultProps} />
      </I18nextProvider>
    );
    
    expect(screen.getByText(/새 버전이 출시되었습니다/)).toBeInTheDocument();
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
  });
  
  it('calls onDismiss when close button clicked', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UpdateBanner {...defaultProps} />
      </I18nextProvider>
    );
    
    const closeButton = screen.getByLabelText(/닫기/);
    fireEvent.click(closeButton);
    
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
  
  it('opens guide link in new tab', () => {
    window.open = jest.fn();
    
    render(
      <I18nextProvider i18n={i18n}>
        <UpdateBanner {...defaultProps} />
      </I18nextProvider>
    );
    
    const guideButton = screen.getByText(/업데이트 가이드/);
    fireEvent.click(guideButton);
    
    expect(window.open).toHaveBeenCalledWith(
      'https://svrforum.com/article_series/dispArticle_seriesView?series_id=8',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
```

```javascript
// useVersionCheck.test.js
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVersionCheck } from './useVersionCheck';
import * as api from '../api';

jest.mock('../api');

describe('useVersionCheck', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });
  
  it('checks version for admin users', async () => {
    const mockResult = {
      current_version: 'v1.0.0',
      latest_digest: 'sha256:new',
      update_available: true
    };
    
    api.checkForUpdates.mockResolvedValue(mockResult);
    
    const { result } = renderHook(() => useVersionCheck('admin'));
    
    await waitFor(() => {
      expect(result.current.currentVersion).toBe('v1.0.0');
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.showBanner).toBe(true);
    });
  });
  
  it('does not check version for regular users', () => {
    const { result } = renderHook(() => useVersionCheck('user'));
    
    expect(api.checkForUpdates).not.toHaveBeenCalled();
    expect(result.current.showBanner).toBe(false);
  });
  
  it('dismisses banner and saves to localStorage', async () => {
    const mockResult = {
      current_version: 'v1.0.0',
      latest_digest: 'sha256:new',
      update_available: true
    };
    
    api.checkForUpdates.mockResolvedValue(mockResult);
    
    const { result } = renderHook(() => useVersionCheck('admin'));
    
    await waitFor(() => {
      expect(result.current.showBanner).toBe(true);
    });
    
    act(() => {
      result.current.dismissBanner();
    });
    
    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem('vdtn_dismissed_update_digest')).toBe('sha256:new');
  });
  
  it('does not show banner if already dismissed', async () => {
    localStorage.setItem('vdtn_dismissed_update_digest', 'sha256:new');
    
    const mockResult = {
      current_version: 'v1.0.0',
      latest_digest: 'sha256:new',
      update_available: true
    };
    
    api.checkForUpdates.mockResolvedValue(mockResult);
    
    const { result } = renderHook(() => useVersionCheck('admin'));
    
    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.showBanner).toBe(false);
    });
  });
});
```

```javascript
// Footer.test.jsx
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import Footer from './Footer';
import i18n from '../i18n';

describe('Footer', () => {
  it('renders version info', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Footer currentVersion="v1.0.0" updateAvailable={false} />
      </I18nextProvider>
    );
    
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
  });
  
  it('shows update badge when update available', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Footer currentVersion="v1.0.0" updateAvailable={true} />
      </I18nextProvider>
    );
    
    expect(screen.getByText(/업데이트 가능/)).toBeInTheDocument();
  });
  
  it('does not show update badge when no update', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Footer currentVersion="v1.0.0" updateAvailable={false} />
      </I18nextProvider>
    );
    
    expect(screen.queryByText(/업데이트 가능/)).not.toBeInTheDocument();
  });
  
  it('renders guide link', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Footer currentVersion="v1.0.0" updateAvailable={false} />
      </I18nextProvider>
    );
    
    const link = screen.getByText(/가이드/);
    expect(link).toHaveAttribute('href', 'https://svrforum.com/article_series/dispArticle_seriesView?series_id=8');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
```

## 테스트 실행 방법

### 수동 테스트
1. 개발 환경 실행
2. 관리자 계정으로 로그인
3. 위의 테스트 시나리오 순서대로 진행

### 자동 테스트 (향후)
```bash
# Frontend 테스트 실행
cd frontend
npm test

# 특정 테스트 파일 실행
npm test UpdateBanner.test.jsx

# 커버리지 확인
npm test -- --coverage
```

## 테스트 체크리스트

- [ ] UpdateBanner 렌더링
- [ ] UpdateBanner 닫기 버튼
- [ ] UpdateBanner 가이드 링크
- [ ] UpdateBanner 반응형 디자인
- [ ] useVersionCheck 관리자 권한 체크
- [ ] useVersionCheck 초기 로드
- [ ] useVersionCheck localStorage 저장
- [ ] useVersionCheck 에러 처리
- [ ] Footer 버전 정보 표시
- [ ] Footer 업데이트 배지
- [ ] Footer 가이드 링크
- [ ] Footer 반응형 디자인

## 알려진 이슈

없음

## 참고 사항

- 실제 Docker Hub API 호출은 Backend에서 처리되므로 Frontend에서는 모킹 필요
- localStorage는 브라우저 개발자 도구에서 확인 가능
- 24시간 주기 체크는 실제 테스트가 어려우므로 개발 시 간격을 짧게 설정
