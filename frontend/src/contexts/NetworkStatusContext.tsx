/**
 * Network Status Context
 * 네트워크 연결 상태를 전역으로 관리하고 오프라인 배너를 표시
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface NetworkStatusContextValue {
  isOnline: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<boolean>;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
};

interface NetworkStatusProviderProps {
  children: ReactNode;
}

export const NetworkStatusProvider = ({ children }: NetworkStatusProviderProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [showBanner, setShowBanner] = useState(!navigator.onLine);

  // 실제 네트워크 연결 확인 (navigator.onLine은 100% 정확하지 않음)
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // 간단한 요청으로 실제 연결 확인
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
      setShowBanner(false);
      return true;
    } catch {
      setIsOnline(false);
      setShowBanner(true);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 브라우저 온라인/오프라인 이벤트 리스너
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // 온라인으로 바뀔 때 실제 연결 확인
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  // API 에러로 인한 오프라인 감지를 위한 전역 이벤트
  useEffect(() => {
    const handleNetworkError = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('network-error', handleNetworkError);

    return () => {
      window.removeEventListener('network-error', handleNetworkError);
    };
  }, []);

  const value: NetworkStatusContextValue = {
    isOnline,
    isChecking,
    checkConnection,
  };

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
      {/* 오프라인 배너 */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">네트워크 오류가 발생했습니다</p>
                <p className="text-sm text-red-100">인터넷 연결을 확인해 주세요.</p>
              </div>
            </div>
            <button
              onClick={checkConnection}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">다시 시도</span>
            </button>
          </div>
        </div>
      )}
    </NetworkStatusContext.Provider>
  );
};
