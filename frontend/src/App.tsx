import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { getCurrentShop } from './api/auth';
import { ToastProvider } from './contexts/ToastContext';
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

// 인증이 필요한 라우트 보호
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
        // 토큰이 만료되었거나 유효하지 않음
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

  return <Layout>{children}</Layout>;
}

function ActivityTrackerWrapper({ children }: { children: React.ReactNode }) {
  useActivityTracker();
  return <>{children}</>;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ActivityTrackerWrapper>
        <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

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
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ActivityTrackerWrapper>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
