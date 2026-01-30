import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { useAuthStore } from './stores/authStore';
import { getCurrentShop } from './api/auth';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import NotFound from './pages/NotFound';

// 활동 추적 및 PIN 타임아웃 체크 훅
function useActivityTracker() {
  const { updateActivity, checkPinTimeout, isAuthenticated, pinVerified } = useAuthStore();

  const handleActivity = useCallback(() => {
    if (isAuthenticated && pinVerified) {
      updateActivity();
    }
  }, [isAuthenticated, pinVerified, updateActivity]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // 페이지 로드 시 PIN 타임아웃 체크
    checkPinTimeout();

    // 주기적으로 PIN 타임아웃 체크 (1분마다)
    const intervalId = setInterval(() => {
      checkPinTimeout();
    }, 60 * 1000);

    // 사용자 활동 이벤트 리스너
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearInterval(intervalId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, handleActivity, checkPinTimeout]);
}

// 서버 에러 감지 및 토스트 표시 훅
function useServerErrorHandler() {
  const toast = useToast();

  useEffect(() => {
    const handleServerError = () => {
      toast.error('서버 오류가 발생했습니다. 관리자에게 문의해 주세요.', 5000);
    };

    window.addEventListener('server-error', handleServerError);

    return () => {
      window.removeEventListener('server-error', handleServerError);
    };
  }, [toast]);
}

// 인증만 확인하는 래퍼 (온보딩 페이지용)
function AuthenticatedOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated || !token) {
        setIsValidating(false);
        setIsValid(false);
        return;
      }

      try {
        await getCurrentShop();
        setIsValid(true);
      } catch {
        logout();
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [isAuthenticated, token, logout]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isValid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 인증이 필요한 라우트 보호 (온보딩 체크 포함)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, logout, onboardingCompleted, setOnboardingCompleted } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated || !token) {
        setIsValidating(false);
        setIsValid(false);
        return;
      }

      try {
        const shop = await getCurrentShop();
        setIsValid(true);
        // 온보딩 상태 동기화
        if (shop.onboarding_completed !== undefined) {
          setOnboardingCompleted(shop.onboarding_completed);
        }
      } catch {
        // 토큰이 만료되었거나 유효하지 않음
        logout();
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [isAuthenticated, token, logout, setOnboardingCompleted]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isValid) {
    return <Navigate to="/login" replace />;
  }

  // 온보딩이 완료되지 않았으면 온보딩 페이지로 리다이렉트
  if (onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Layout>{children}</Layout>;
}

function ActivityTrackerWrapper({ children }: { children: React.ReactNode }) {
  useActivityTracker();
  useServerErrorHandler();
  return <>{children}</>;
}

function App() {
  return (
    <ToastProvider>
      <NetworkStatusProvider>
        <BrowserRouter>
          <VercelAnalytics />
          <ActivityTrackerWrapper>
          <Routes>
          {/* 공개 라우트 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* 온보딩 라우트 (인증만 필요, 온보딩 체크 안함) */}
          <Route
            path="/onboarding"
            element={
              <AuthenticatedOnly>
                <Onboarding />
              </AuthenticatedOnly>
            }
          />

          {/* 보호된 라우트 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute>
                <CustomerDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
          </Routes>
          </ActivityTrackerWrapper>
        </BrowserRouter>
      </NetworkStatusProvider>
    </ToastProvider>
  );
}

export default App;
