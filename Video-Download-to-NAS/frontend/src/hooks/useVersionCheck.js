/**
 * useVersionCheck Hook
 * 버전 체크 및 업데이트 알림 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { checkForUpdates } from '../api';

const STORAGE_KEY = 'vdtn_dismissed_update_time';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24시간

export const useVersionCheck = (userRole) => {
  const [currentVersion, setCurrentVersion] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dockerhubUpdateTime, setDockerhubUpdateTime] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // 관리자만 체크
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';

  // 버전 체크 함수
  const checkVersion = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setIsChecking(true);
      const result = await checkForUpdates();
      
      setCurrentVersion(result.current_version);
      setDockerhubUpdateTime(result.dockerhub_update_time);
      setUpdateAvailable(result.update_available);

      // 업데이트가 있고, 이전에 닫지 않은 경우 배너 표시
      if (result.update_available && result.dockerhub_update_time) {
        const dismissedTime = localStorage.getItem(STORAGE_KEY);
        if (dismissedTime !== result.dockerhub_update_time) {
          setShowBanner(true);
        }
      } else {
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Version check failed:', error);
      // 에러 시 조용히 실패 (사용자에게 알리지 않음)
    } finally {
      setIsChecking(false);
    }
  }, [isAdmin]);

  // 배너 닫기
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    if (dockerhubUpdateTime) {
      localStorage.setItem(STORAGE_KEY, dockerhubUpdateTime);
    }
  }, [dockerhubUpdateTime]);

  // 초기 로드 및 주기적 체크
  useEffect(() => {
    if (!isAdmin) return;

    // 초기 체크
    checkVersion();

    // 24시간마다 체크
    const interval = setInterval(() => {
      checkVersion();
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [isAdmin, checkVersion]);

  return {
    currentVersion,
    updateAvailable,
    dockerhubUpdateTime,
    showBanner,
    isChecking,
    dismissBanner,
    checkVersion
  };
};
